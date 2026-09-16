-- Entire test is rolled back. Never run this against a hosted CRM.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions, pg_temp;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','owner@sql.test','{"full_name":"Owner"}'),
 ('10000000-0000-0000-0000-000000000002','other@sql.test','{"full_name":"Other"}'),
 ('10000000-0000-0000-0000-000000000003','agent@sql.test','{"full_name":"Agent"}'),
 ('10000000-0000-0000-0000-000000000004','viewer@sql.test','{"full_name":"Viewer"}');
create temporary table tenants as select
 (select account_id from profiles where user_id='10000000-0000-0000-0000-000000000001') a,
 (select account_id from profiles where user_id='10000000-0000-0000-0000-000000000002') b;
grant select on tenants to authenticated;
update profiles set account_id=(select a from tenants),account_role='agent' where user_id='10000000-0000-0000-0000-000000000003';
update profiles set account_id=(select a from tenants),account_role='viewer' where user_id='10000000-0000-0000-0000-000000000004';
insert into pipelines(id,user_id,account_id,name,model_key,is_demo) select
 '20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',a,'Official','creacom',false from tenants;
insert into pipelines(id,user_id,account_id,name,model_key,is_demo) select
 '20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',b,'Other','creacom',false from tenants;
insert into pipelines(id,user_id,account_id,name,model_key,is_demo) select
 '20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',a,'DEMO','creacom',true from tenants;
insert into pipeline_stages(id,pipeline_id,name,position,color,semantic_key)
select md5(p.id::text||key)::uuid,p.id,key,n,'#ED3237',key from pipelines p
cross join (values ('new',0),('qualifying',1),('ready_to_quote',2),('quote_sent',3),('negotiation',4),('won',5),('not_converted',6)) s(key,n);
insert into contacts(id,user_id,account_id,name,phone) select
 '30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',a,'Client','+593990000001' from tenants;
insert into contacts(id,user_id,account_id,name,phone) select
 '30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',b,'Other client','+593990000002' from tenants;
insert into conversations(id,user_id,account_id,contact_id) select
 '40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',b,'30000000-0000-0000-0000-000000000002' from tenants;
insert into deal_loss_reasons(id,account_id,code,name,requires_detail) select
 '50000000-0000-0000-0000-000000000001',a,'other','Otro',true from tenants;
insert into deal_loss_reasons(id,account_id,code,name) select
 '50000000-0000-0000-0000-000000000002',b,'price','Precio' from tenants;

select ok((select relrowsecurity from pg_class where oid='deal_loss_reasons'::regclass),'catalog RLS enabled');
select ok(not (select prosecdef from pg_proc where oid='creacom_metrics(uuid)'::regprocedure),'metrics SECURITY INVOKER');
select ok(not has_function_privilege('anon','creacom_metrics(uuid)','execute'),'anonymous metrics revoked');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select lives_ok($$insert into deals(user_id,account_id,pipeline_id,stage_id,contact_id,title,estimated_volume_m3,concrete_strength,work_location,scheduled_date,expected_close_date,needs_pump,mixer_access,value)
select auth.uid(),a,'20000000-0000-0000-0000-000000000001',md5('20000000-0000-0000-0000-000000000001new')::uuid,'30000000-0000-0000-0000-000000000001','Losa',25.125,'H-240','Quevedo','2026-10-10','2026-10-05','yes','no',1250 from tenants$$,'create concrete work');
select lives_ok($$insert into deals(user_id,account_id,pipeline_id,stage_id,contact_id,title)
select auth.uid(),a,'20000000-0000-0000-0000-000000000001',md5('20000000-0000-0000-0000-000000000001new')::uuid,'30000000-0000-0000-0000-000000000001','Galpón' from tenants$$,'create incomplete second work');
select is((select count(*) from deals where contact_id='30000000-0000-0000-0000-000000000001'),2::bigint,'multiple works per client');
select is((select concrete_strength from deals where title='Losa'),'H-240','strength persists');
select is((select estimated_volume_m3 from deals where title='Losa'),25.125::numeric,'decimal volume persists');
select isnt((select scheduled_date from deals where title='Losa'),(select expected_close_date from deals where title='Losa'),'delivery and close dates distinct');
select throws_ok($$update deals set estimated_volume_m3=0 where title='Losa'$$,'23514',null,'volume positive');
select throws_ok($$update deals set concrete_strength='H-999' where title='Losa'$$,'23514',null,'strength enum');
select throws_ok($$update deals set concrete_strength='other',concrete_strength_other=' ' where title='Losa'$$,'23514',null,'other strength explanation');
select throws_ok($$update deals set needs_pump='maybe' where title='Losa'$$,'23514',null,'pump tri-state');
select throws_ok($$update deals set mixer_access='maybe' where title='Losa'$$,'23514',null,'mixer tri-state');
select throws_ok($$update deals set contact_id='30000000-0000-0000-0000-000000000002' where title='Losa'$$,'23503',null,'cross-account contact rejected');
select throws_ok($$update deals set pipeline_id='20000000-0000-0000-0000-000000000002' where title='Losa'$$,'23503',null,'cross-account pipeline rejected');
select throws_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000002new')::uuid where title='Losa'$$,'23503',null,'stage must belong to pipeline');
select throws_ok($$update deals set conversation_id='40000000-0000-0000-0000-000000000002' where title='Losa'$$,'23503',null,'cross-account conversation rejected');
reset role;
create temporary table foreign_assignee as select id from profiles where user_id='10000000-0000-0000-0000-000000000002';
grant select on foreign_assignee to authenticated;
set local role authenticated;
select throws_ok($$update deals set assigned_to=(select id from foreign_assignee) where title='Losa'$$,'23503',null,'cross-account advisor rejected');
select throws_ok($$update deals set loss_reason_id='50000000-0000-0000-0000-000000000002' where title='Losa'$$,'23503',null,'cross-account reason rejected');
select lives_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001negotiation')::uuid where title='Galpón'$$,'manual move with missing data');
select throws_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001not_converted')::uuid where title='Galpón'$$,'23514',null,'loss requires reason');
select is((select status from deals where title='Galpón'),'open','failed closure keeps old result');
select throws_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001not_converted')::uuid,loss_reason_id='50000000-0000-0000-0000-000000000001' where title='Galpón'$$,'23514',null,'other reason requires explanation');
select lives_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001not_converted')::uuid,loss_reason_id='50000000-0000-0000-0000-000000000001',loss_reason_detail='Cambio de proyecto' where title='Galpón'$$,'close with reason');
select is((select status from deals where title='Galpón'),'lost','stage derives lost compatibility status');
select lives_ok($$update deal_loss_reasons set is_active=false where code='other'$$,'administrator deactivates catalog');
select lives_ok($$update deals set notes='Seguimiento histórico' where title='Galpón'$$,'inactive reason preserves history');
select lives_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001qualifying')::uuid where title='Galpón'$$,'reopen to an open stage');
select is((select status from deals where title='Galpón'),'open','reopening derives open');
select throws_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001not_converted')::uuid where title='Galpón'$$,'23514',null,'new closure cannot reuse inactive reason');
select lives_ok($$update deals set stage_id=md5('20000000-0000-0000-0000-000000000001won')::uuid,status='lost' where title='Losa'$$,'stage overrides conflicting status');
select is((select status from deals where title='Losa'),'won','won status synchronized');
select lives_ok($$update pipeline_stages set name='Venta confirmada',position=0 where semantic_key='won' and pipeline_id='20000000-0000-0000-0000-000000000001'$$,'rename/reorder keeps stage meaning');
select throws_ok($$update pipeline_stages set semantic_key='new' where semantic_key='won' and pipeline_id='20000000-0000-0000-0000-000000000001'$$,'23514',null,'technical keys stable');

-- Real purchase outcomes, lead source, follow-up and reports.
select lives_ok($$update contacts set lead_source='referral' where id='30000000-0000-0000-0000-000000000001'$$,'lead source persists');
select throws_ok($$update contacts set lead_source='invented' where id='30000000-0000-0000-0000-000000000001'$$,'23514',null,'lead source catalog enforced');
select lives_ok($$update deals set actual_volume_m3=22,final_sale_value=1200,sale_date='2026-09-15',sale_evidence='confirmed_sale' where title='Losa'$$,'confirmed real sale result');
select throws_ok($$update deals set actual_volume_m3=null where title='Losa'$$,'23514',null,'confirmed sale keeps complete actuals');
select lives_ok($$update deals set next_follow_up_at='2026-09-16 14:00+00',follow_up_status='pending',follow_up_reason='Confirmar fecha' where title='Galpón'$$,'follow-up persists');
select throws_ok($$update deals set follow_up_status=null where title='Galpón'$$,'23514',null,'follow-up date and status stay paired');
select is((creacom_metrics()->>'sold_m3')::numeric,22::numeric,'dashboard uses real sold m3');
select is((creacom_contact_summary('30000000-0000-0000-0000-000000000001')->>'actual_volume_m3')::numeric,22::numeric,'contact history accumulates real purchases');
select is((select actual_volume_m3 from creacom_report('source') where label='referral'),22::numeric,'report groups confirmed sales by source');
select ok(exists(select 1 from domain_events where event_type='deal_won'),'stage changes emit domain events');

-- RLS roles and isolated account.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select is((select count(*) from deal_loss_reasons),1::bigint,'agent reads own catalog only');
select throws_ok($$insert into deal_loss_reasons(account_id,code,name) select a,'custom','Custom' from tenants$$,'42501',null,'agent cannot edit catalog');
select lives_ok($$update deals set work_location='El Empalme' where title='Galpón'$$,'agent edits own work');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select results_eq($$update deals set title='Forbidden' where title='Galpón' returning title$$,array[]::text[],'viewer cannot edit deals');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is((select count(*) from deals),0::bigint,'other account cannot read works');
select is((creacom_metrics()->>'open_count')::int,0,'RPC isolates accounts');
select results_eq($$update deals set title='Forbidden' returning title$$,array[]::text[],'other account cannot update');

-- >1000 rows demonstrates DB-side aggregation beyond PostgREST row cap.
reset role;
insert into deals(user_id,account_id,pipeline_id,stage_id,contact_id,title,estimated_volume_m3,currency,value,created_at)
select '10000000-0000-0000-0000-000000000001',a,'20000000-0000-0000-0000-000000000001',md5('20000000-0000-0000-0000-000000000001new')::uuid,'30000000-0000-0000-0000-000000000001','Bulk '||n,1,'EUR',2,'2020-01-01' from tenants cross join generate_series(1,1005) n;
insert into deals(user_id,account_id,pipeline_id,stage_id,contact_id,title,estimated_volume_m3,value)
select '10000000-0000-0000-0000-000000000001',a,'20000000-0000-0000-0000-000000000003',md5('20000000-0000-0000-0000-000000000003new')::uuid,'30000000-0000-0000-0000-000000000001','DEMO inflated',999,999999 from tenants;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select is((creacom_metrics()->>'open_count')::int,1006,'all history, excludes DEMO');
select is((creacom_metrics()->>'open_m3')::numeric,1005::numeric,'only registered open m3');
select is((creacom_metrics()->>'won_m3')::numeric,25.125::numeric,'won m3 accumulated');
select is((creacom_metrics()->>'pending_open_volume')::int,1,'pending volume reported');
select is(jsonb_array_length(creacom_metrics()->'currencies'),2,'currencies remain separate');
select is((creacom_metrics('20000000-0000-0000-0000-000000000003')->>'open_count')::int,1,'explicit DEMO board can inspect its own summary');
select lives_ok($$delete from contacts where id='30000000-0000-0000-0000-000000000001'$$,'contact deletion preserves work history');
select is((select count(*) from deals where contact_id is null),1008::bigint,'orphaned work history retained');
reset role;
select has_column('ai_configs','base_url','AI provider base URL is configurable');
select has_column('conversations','ai_handoff_state','handoff state persists');
select has_table('ai_change_log','AI change audit table exists');
select ok((select relrowsecurity from pg_class where oid='ai_change_log'::regclass),'AI audit RLS enabled');
select ok((select count(*) from pg_policies where schemaname='public' and tablename='ai_change_log' and policyname='ai_change_log_select')=1,'AI audit account read policy');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select throws_ok($$insert into ai_change_log(account_id,field_name,origin) select b,'estimated_volume_m3','ai' from tenants$$,'42501',null,'AI audit cannot cross accounts');
select has_table('domain_events','commercial domain event table exists');
select ok((select relrowsecurity from pg_class where oid='domain_events'::regclass),'domain events RLS enabled');
select ok(not has_function_privilege('anon','creacom_report(text,date,date)','execute'),'anonymous reports revoked');
select * from finish();
rollback;
