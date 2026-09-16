-- Bloque A: inteligencia comercial, historial, compras, seguimiento y campanas seguras.
-- Expansion compatible: no conecta Meta/WhatsApp ni habilita envios.

alter table public.contacts
  add column lead_source text not null default 'unknown'
    check (lead_source in (
      'whatsapp_direct','website','facebook_ads','instagram','google',
      'referral','recurring_customer','manual','other','unknown'
    ));

alter table public.deals
  add column actual_volume_m3 numeric(14,3)
    check (actual_volume_m3 > 0 and actual_volume_m3 <> 'NaN'::numeric),
  add column final_sale_value numeric(14,2)
    check (final_sale_value >= 0 and final_sale_value <> 'NaN'::numeric),
  add column sale_date date,
  add column sale_evidence text not null default 'unknown'
    check (sale_evidence in ('unknown','possible_historical_sale','confirmed_sale')),
  add column commercial_intent text not null default 'unknown'
    check (commercial_intent in ('unknown','low','medium','high')),
  add column quote_requested boolean not null default false,
  add column human_requested boolean not null default false,
  add column next_follow_up_at timestamptz,
  add column follow_up_reason text,
  add column follow_up_status text
    check (follow_up_status in ('pending','completed','cancelled')),
  add constraint deal_follow_up_complete check (
    (next_follow_up_at is null and follow_up_status is null)
    or (next_follow_up_at is not null and follow_up_status is not null)
  ),
  add constraint deal_confirmed_sale_requires_won check (
    sale_evidence <> 'confirmed_sale' or status = 'won'
  ),
  add constraint deal_confirmed_sale_has_result check (
    sale_evidence <> 'confirmed_sale'
    or (actual_volume_m3 is not null and final_sale_value is not null and sale_date is not null)
  );

create index deals_pending_follow_up
  on public.deals(account_id, next_follow_up_at)
  where follow_up_status = 'pending';
create index deals_sale_date
  on public.deals(account_id, sale_date desc)
  where sale_evidence = 'confirmed_sale';
create index contacts_lead_source on public.contacts(account_id, lead_source);

-- Existing campaign delivery remains untouched. These fields identify CRM-planning
-- campaigns and make the no-send boundary explicit until a later Meta block.
alter table public.broadcasts
  add column crm_segment_key text,
  add column crm_segment_params jsonb not null default '{}'::jsonb,
  add column planning_only boolean not null default true,
  add column calculated_recipients integer not null default 0
    check (calculated_recipients >= 0);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null check (event_type in (
    'contact_created','deal_created','deal_qualified','ready_to_quote',
    'quote_sent','deal_won','deal_lost','follow_up_due'
  )),
  aggregate_type text not null check (aggregate_type in ('contact','deal')),
  aggregate_id uuid not null,
  actor_type text not null default 'human' check (actor_type in ('human','ai','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index domain_events_account_time on public.domain_events(account_id, occurred_at desc);
create index domain_events_aggregate on public.domain_events(account_id, aggregate_type, aggregate_id, occurred_at desc);
create index domain_events_actor on public.domain_events(actor_user_id) where actor_user_id is not null;
alter table public.domain_events enable row level security;
grant select, insert on public.domain_events to authenticated;
grant all on public.domain_events to service_role;
revoke all on public.domain_events from anon;
create policy domain_events_select on public.domain_events for select to authenticated
  using (public.is_account_member(account_id));
create policy domain_events_insert on public.domain_events for insert to authenticated
  with check (public.is_account_member(account_id, 'agent'));
comment on table public.domain_events is
  'Append-only commercial domain events. Payloads must exclude secrets and chain of thought.';

create function public.emit_creacom_domain_event() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  emitted_type text;
  stage_key text;
  aggregate_kind text;
begin
  if tg_table_name='contacts' then
    emitted_type := 'contact_created';
    aggregate_kind := 'contact';
  elsif tg_op='INSERT' then
    emitted_type := 'deal_created';
    aggregate_kind := 'deal';
  elsif new.stage_id is distinct from old.stage_id then
    select semantic_key into stage_key from public.pipeline_stages where id=new.stage_id;
    emitted_type := case stage_key
      when 'qualifying' then 'deal_qualified'
      when 'ready_to_quote' then 'ready_to_quote'
      when 'quote_sent' then 'quote_sent'
      when 'won' then 'deal_won'
      when 'not_converted' then 'deal_lost'
    end;
    aggregate_kind := 'deal';
  end if;
  if emitted_type is not null then
    insert into public.domain_events(account_id,event_type,aggregate_type,aggregate_id,actor_type,actor_user_id,payload)
    values (new.account_id,emitted_type,aggregate_kind,new.id,
      'system',
      auth.uid(),jsonb_build_object('source','database_trigger'));
  end if;
  return new;
end $$;
revoke all on function public.emit_creacom_domain_event() from public, anon, authenticated;
create trigger emit_creacom_contact_created after insert on public.contacts
  for each row execute function public.emit_creacom_domain_event();
create trigger emit_creacom_deal_event after insert or update of stage_id on public.deals
  for each row execute function public.emit_creacom_domain_event();

-- Extend the existing append-only audit to human edits without allowing a
-- signed-in user to impersonate another actor or write system-origin rows.
drop policy if exists ai_change_log_insert on public.ai_change_log;
create policy ai_change_log_insert on public.ai_change_log for insert to authenticated
  with check (
    public.is_account_member(account_id, 'agent')
    and (
      origin = 'ai'
      or (origin = 'human' and actor_user_id = auth.uid())
    )
  );
create index if not exists ai_change_log_actor on public.ai_change_log(actor_user_id) where actor_user_id is not null;
create index if not exists ai_change_log_conversation on public.ai_change_log(conversation_id) where conversation_id is not null;

create or replace function public.creacom_metrics(p_pipeline_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select d.*, s.semantic_key from public.deals d
    join public.pipelines p on p.id=d.pipeline_id
    join public.pipeline_stages s on s.id=d.stage_id and s.pipeline_id=p.id
    where p.model_key='creacom' and public.is_account_member(p.account_id)
      and ((p_pipeline_id is null and not p.is_demo) or p.id=p_pipeline_id)
  ), counts as (select semantic_key,count(*) n from eligible group by semantic_key),
  amounts as (select coalesce(nullif(currency,''),'UNKNOWN') currency,
    coalesce(sum(value) filter(where status='open'),0) open_value,
    coalesce(sum(value) filter(where status='won'),0) won_value,
    coalesce(sum(final_sale_value) filter(where sale_evidence='confirmed_sale'),0) sold_value
    from eligible group by 1)
  select jsonb_build_object(
    'pipeline_count',(select count(*) from public.pipelines p where p.model_key='creacom'
      and public.is_account_member(p.account_id)
      and ((p_pipeline_id is null and not p.is_demo) or p.id=p_pipeline_id)),
    'stages',coalesce((select jsonb_object_agg(semantic_key,n) from counts),'{}'::jsonb),
    'open_count',count(*) filter(where status='open'),
    'open_m3',coalesce(sum(estimated_volume_m3) filter(where status='open'),0),
    'negotiation_m3',coalesce(sum(estimated_volume_m3) filter(where semantic_key='negotiation'),0),
    'won_m3',coalesce(sum(estimated_volume_m3) filter(where status='won'),0),
    'sold_m3',coalesce(sum(actual_volume_m3) filter(where sale_evidence='confirmed_sale'),0),
    'sold_value',coalesce(sum(final_sale_value) filter(where sale_evidence='confirmed_sale'),0),
    'pending_open_volume',count(*) filter(where status='open' and estimated_volume_m3 is null),
    'pending_negotiation_volume',count(*) filter(where semantic_key='negotiation' and estimated_volume_m3 is null),
    'pending_won_volume',count(*) filter(where status='won' and estimated_volume_m3 is null),
    'won_missing_actuals',count(*) filter(where status='won' and (actual_volume_m3 is null or final_sale_value is null or sale_date is null)),
    'follow_ups_due',count(*) filter(where follow_up_status='pending' and next_follow_up_at <= now()),
    'inactive_open',count(*) filter(where status='open' and updated_at < now() - interval '14 days'),
    'currencies',coalesce((select jsonb_agg(to_jsonb(amounts) order by currency) from amounts),'[]'::jsonb)
  ) from eligible;
$$;
revoke all on function public.creacom_metrics(uuid) from public, anon;
grant execute on function public.creacom_metrics(uuid) to authenticated, service_role;

create or replace function public.creacom_contact_summary(p_contact_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select d.*, s.semantic_key
    from public.deals d
    join public.pipeline_stages s on s.id=d.stage_id and s.pipeline_id=d.pipeline_id
    where d.contact_id=p_contact_id and public.is_account_member(d.account_id)
  )
  select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter(where status='open'),
    'won',count(*) filter(where status='won'),
    'not_converted',count(*) filter(where status='lost'),
    'actual_volume_m3',coalesce(sum(actual_volume_m3) filter(where sale_evidence='confirmed_sale'),0),
    'last_sale_date',max(sale_date) filter(where sale_evidence='confirmed_sale'),
    'next_follow_up_at',min(next_follow_up_at) filter(where follow_up_status='pending'),
    'currencies',coalesce(jsonb_agg(distinct jsonb_build_object('currency',coalesce(currency,'UNKNOWN'),'value',0))
      filter(where sale_evidence='confirmed_sale'),'[]'::jsonb),
    'sold_values',coalesce((select jsonb_agg(to_jsonb(v) order by currency) from (
      select coalesce(currency,'UNKNOWN') currency,coalesce(sum(final_sale_value),0) value
      from eligible where sale_evidence='confirmed_sale' group by 1
    ) v),'[]'::jsonb)
  ) from eligible;
$$;
revoke all on function public.creacom_contact_summary(uuid) from public, anon;
grant execute on function public.creacom_contact_summary(uuid) to authenticated, service_role;

create or replace function public.creacom_report(
  p_group_by text,
  p_from date default null,
  p_to date default null
) returns table(label text, actual_volume_m3 numeric, final_sale_value numeric, opportunities bigint)
language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select d.*, c.name contact_name, c.company, c.lead_source,
      s.name stage_name, r.name loss_reason_name
    from public.deals d
    join public.contacts c on c.id=d.contact_id and c.account_id=d.account_id
    join public.pipelines p on p.id=d.pipeline_id and p.model_key='creacom' and not p.is_demo
    join public.pipeline_stages s on s.id=d.stage_id and s.pipeline_id=d.pipeline_id
    left join public.deal_loss_reasons r on r.id=d.loss_reason_id
    where public.is_account_member(d.account_id)
      and (p_from is null or coalesce(d.sale_date,d.created_at::date)>=p_from)
      and (p_to is null or coalesce(d.sale_date,d.created_at::date)<=p_to)
  ), grouped as (
    select case p_group_by
      when 'client' then coalesce(contact_name,'Sin nombre')
      when 'company' then coalesce(company,'Sin empresa')
      when 'period' then to_char(date_trunc('month',coalesce(sale_date,created_at::date)),'YYYY-MM')
      when 'strength' then coalesce(concrete_strength,'unknown')
      when 'location' then coalesce(work_location,'Sin ubicación')
      when 'source' then coalesce(lead_source,'unknown')
      when 'stage' then coalesce(stage_name,'Sin etapa')
      when 'loss_reason' then coalesce(loss_reason_name,'Sin motivo')
    end label,
    coalesce(sum(actual_volume_m3) filter(where sale_evidence='confirmed_sale'),0) actual_volume_m3,
    coalesce(sum(final_sale_value) filter(where sale_evidence='confirmed_sale'),0) final_sale_value,
    count(*) opportunities
    from eligible
    where p_group_by in ('client','company','period','strength','location','source','stage','loss_reason')
    group by 1
  )
  select * from grouped order by actual_volume_m3 desc, opportunities desc, label;
$$;
revoke all on function public.creacom_report(text,date,date) from public, anon;
grant execute on function public.creacom_report(text,date,date) to authenticated, service_role;
