-- LOCAL CI ONLY. Hosted WACRM already has these CRUD grants; its original
-- 001-041 migrations relied on dashboard defaults, absent in fresh CLI stacks.
-- Do not apply this bootstrap to hosted projects. RLS remains authoritative.
do $$ begin
  grant usage on schema public to authenticated, service_role;
  grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
  grant usage, select on all sequences in schema public to authenticated, service_role;
end $$;
