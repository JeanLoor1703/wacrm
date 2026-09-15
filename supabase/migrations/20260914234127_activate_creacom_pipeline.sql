-- APPLY LAST: only after the new application is deployed and verified.
-- Fresh assertion plus locks protects against data arriving during activation.
do $$
declare a uuid; official uuid; demo uuid; stage record; expected text[];
begin
  select ac.id into a from public.accounts ac join auth.users u on u.id=ac.owner_user_id
    where lower(u.email)='creahormigonera@gmail.com';
  if a is null then return; end if; -- clean CI database / unrelated installation
  select id into official from public.pipelines where account_id=a and name='Sales Pipeline' for update;
  if official is null then raise exception 'Expected official pipeline absent; inspect before activation'; end if;
  lock table public.deals in share row exclusive mode;
  if exists(select 1 from public.deals where pipeline_id=official) then
    raise exception 'Official pipeline now contains opportunities: preserve data and review mapping before activation';
  end if;
  select array_agg(name order by position) into expected from public.pipeline_stages where pipeline_id=official;
  if expected is distinct from array['New Lead','Qualified','Proposal Sent','Negotiation','Won']::text[] then
    raise exception 'Unexpected official stage configuration; activation aborted';
  end if;
  if (select count(*) from public.pipelines where account_id=a and name='Sales Pipeline')<>1 then
    raise exception 'Ambiguous official pipeline';
  end if;
  -- Retain all five existing stage IDs. Only names/positions/technical keys change.
  for stage in select * from (values
    ('New Lead','Nuevo','new',0),('Qualified','Calificando','qualifying',1),
    ('Proposal Sent','Cotización enviada','quote_sent',3),
    ('Negotiation','Negociación','negotiation',4),('Won','Ganado','won',5)
  ) s(old_name,new_name,key,pos) loop
    update public.pipeline_stages set name=stage.new_name,semantic_key=stage.key,position=stage.pos
      where pipeline_id=official and name=stage.old_name;
  end loop;
  insert into public.pipeline_stages(pipeline_id,name,semantic_key,position,color) values
    (official,'Listo para cotizar','ready_to_quote',2,'#D97706'),
    (official,'No concretado','not_converted',6,'#747474');
  update public.pipelines set name='Ventas CREACOM',model_key='creacom',is_demo=false where id=official;

  select id into demo from public.pipelines where account_id=a and name='DEMO — Embudo CREACOM (auditoría)' for update;
  if demo is not null then
    select array_agg(name order by position) into expected from public.pipeline_stages where pipeline_id=demo;
    if expected is distinct from array['Nuevo','Calificando','Listo para cotizar','Cotización enviada','Negociación','Ganado','Perdido']::text[] then
      raise exception 'Unexpected DEMO stages; preserve and inspect before activation';
    end if;
    if exists(select 1 from public.deals where pipeline_id=demo and status is distinct from 'open') then
      raise exception 'Unexpected closed DEMO opportunity; review historical reason before activation';
    end if;
    update public.pipeline_stages set semantic_key=(array['new','qualifying','ready_to_quote','quote_sent','negotiation','won','not_converted'])[position+1],
      name=case when name='Perdido' then 'No concretado' else name end where pipeline_id=demo;
    update public.pipelines set model_key='creacom',is_demo=true where id=demo;
    -- No DEMO opportunity is changed or deleted.
  end if;
end $$;
