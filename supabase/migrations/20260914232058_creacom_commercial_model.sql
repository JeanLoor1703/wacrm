-- Compatible expansion only. Official pipeline activation is a separate release step.
alter table public.pipelines
  add column model_key text check (model_key is null or model_key = 'creacom'),
  add column is_demo boolean not null default false;
alter table public.pipeline_stages
  add column semantic_key text check (semantic_key in
    ('new','qualifying','ready_to_quote','quote_sent','negotiation','won','not_converted'));
create unique index pipeline_stage_semantics on public.pipeline_stages(pipeline_id, semantic_key)
  where semantic_key is not null;

create table public.deal_loss_reasons (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  requires_detail boolean not null default false,
  created_at timestamptz not null default now(),
  unique(account_id, code),
  check (code <> 'other' or requires_detail)
);
alter table public.deal_loss_reasons enable row level security;
grant select, insert, update on public.deal_loss_reasons to authenticated;
grant all on public.deal_loss_reasons to service_role;
revoke all on public.deal_loss_reasons from anon;
create policy reasons_read on public.deal_loss_reasons for select to authenticated
  using (public.is_account_member(account_id));
create policy reasons_insert on public.deal_loss_reasons for insert to authenticated
  with check (public.is_account_member(account_id, 'admin'));
create policy reasons_update on public.deal_loss_reasons for update to authenticated
  using (public.is_account_member(account_id, 'admin'))
  with check (public.is_account_member(account_id, 'admin'));

alter table public.deals
  add column work_type text,
  add column work_location text,
  add column concrete_strength text not null default 'unknown'
    check (concrete_strength in ('H-180','H-210','H-240','H-280','other','unknown')),
  add column concrete_strength_other text,
  add column estimated_volume_m3 numeric(14,3)
    check (estimated_volume_m3 > 0 and estimated_volume_m3 <> 'NaN'::numeric),
  add column scheduled_date date,
  add column needs_pump text not null default 'unknown' check (needs_pump in ('yes','no','unknown')),
  add column mixer_access text not null default 'unknown' check (mixer_access in ('yes','no','unknown')),
  add column loss_reason_id uuid references public.deal_loss_reasons(id) on delete restrict,
  add column loss_reason_detail text,
  add constraint strength_other_description check
    (concrete_strength <> 'other' or length(trim(coalesce(concrete_strength_other,''))) > 0);
create index deals_loss_reason on public.deals(loss_reason_id) where loss_reason_id is not null;
create index creacom_pipelines_account on public.pipelines(account_id) where model_key = 'creacom';

-- Composite FKs protect against concurrent writes and future parent-account changes,
-- including privileged API/automation writes. Keep original FKs for compatible embeds.
alter table public.pipelines add constraint pipelines_id_account unique(id, account_id);
alter table public.contacts add constraint contacts_id_account unique(id, account_id);
alter table public.conversations add constraint conversations_id_account unique(id, account_id);
alter table public.profiles add constraint profiles_id_account unique(id, account_id);
alter table public.pipeline_stages add constraint stages_id_pipeline unique(id, pipeline_id);
alter table public.deal_loss_reasons add constraint reasons_id_account unique(id, account_id);
alter table public.deals
  add constraint deal_pipeline_account foreign key(pipeline_id,account_id)
    references public.pipelines(id,account_id) on delete cascade,
  add constraint deal_stage_pipeline foreign key(stage_id,pipeline_id)
    references public.pipeline_stages(id,pipeline_id),
  add constraint deal_contact_account foreign key(contact_id,account_id)
    references public.contacts(id,account_id) on delete set null (contact_id),
  add constraint deal_conversation_account foreign key(conversation_id,account_id)
    references public.conversations(id,account_id) on delete set null (conversation_id),
  add constraint deal_assignee_account foreign key(assigned_to,account_id)
    references public.profiles(id,account_id) on delete set null (assigned_to),
  add constraint deal_reason_account foreign key(loss_reason_id,account_id)
    references public.deal_loss_reasons(id,account_id);

create function public.validate_creacom_deal() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare model text; stage_key text; reason public.deal_loss_reasons;
begin
  select p.model_key, s.semantic_key into model, stage_key
    from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
    where p.id = new.pipeline_id and s.id = new.stage_id;
  if model = 'creacom' then
    if stage_key is null then raise exception 'CREACOM stage requires a semantic key' using errcode='23514'; end if;
    if length(trim(new.title)) = 0 or (tg_op = 'INSERT' and new.contact_id is null) then
      -- Existing ON DELETE SET NULL continues to preserve contact history.
      raise exception 'Client and work are required' using errcode='23514';
    end if;
    new.status := case stage_key when 'won' then 'won' when 'not_converted' then 'lost' else 'open' end;
    if stage_key = 'not_converted' then
      select * into reason from public.deal_loss_reasons where id = new.loss_reason_id;
      if reason.id is null or reason.account_id <> new.account_id then
        raise exception 'A loss reason from this account is required' using errcode='23514';
      end if;
      if not reason.is_active and (tg_op='INSERT' or new.loss_reason_id is distinct from old.loss_reason_id
        or old.status is distinct from 'lost') then
        raise exception 'Choose an active loss reason' using errcode='23514';
      end if;
      if reason.requires_detail and length(trim(coalesce(new.loss_reason_detail,'')))=0 then
        raise exception 'Explain the loss reason' using errcode='23514';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_creacom_deal() from public, anon, authenticated;
create trigger validate_creacom_deal before insert or update on public.deals
  for each row execute function public.validate_creacom_deal();

-- Technical meaning cannot be reassigned by renaming/reordering/deleting a stage.
create function public.preserve_creacom_stage() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.semantic_key is not null and exists(select 1 from public.pipelines
    where id=old.pipeline_id and model_key='creacom') then
    if tg_op='DELETE' or new.semantic_key is distinct from old.semantic_key
      or new.pipeline_id <> old.pipeline_id then
      raise exception 'CREACOM stage semantics are immutable' using errcode='23514';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.preserve_creacom_stage() from public, anon, authenticated;
create trigger preserve_creacom_stage before update or delete on public.pipeline_stages
  for each row execute function public.preserve_creacom_stage();

create function public.creacom_metrics(p_pipeline_id uuid default null) returns jsonb
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
    coalesce(sum(value) filter(where status='won'),0) won_value
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
    'pending_open_volume',count(*) filter(where status='open' and estimated_volume_m3 is null),
    'pending_negotiation_volume',count(*) filter(where semantic_key='negotiation' and estimated_volume_m3 is null),
    'pending_won_volume',count(*) filter(where status='won' and estimated_volume_m3 is null),
    'currencies',coalesce((select jsonb_agg(to_jsonb(amounts) order by currency) from amounts),'[]'::jsonb)
  ) from eligible;
$$;
revoke all on function public.creacom_metrics(uuid) from public, anon;
grant execute on function public.creacom_metrics(uuid) to authenticated, service_role;

-- Seed only the authorized CREACOM account, not other tenants.
insert into public.deal_loss_reasons(account_id,code,name,requires_detail)
select a.id,r.code,r.name,r.detail from public.accounts a
join auth.users u on u.id=a.owner_user_id
cross join (values ('price','Precio',false),('no_response','No respondió',false),
  ('competitor','Eligió competencia',false),('postponed','Obra aplazada',false),
  ('budget','Sin presupuesto',false),('conditions','No cumple condiciones',false),
  ('other','Otro',true)) r(code,name,detail)
where lower(u.email)='creahormigonera@gmail.com';

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.deals;
  end if;
end $$;
