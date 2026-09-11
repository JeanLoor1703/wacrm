-- ============================================================
-- 041_harden_trigger_helpers.sql
--
-- Pin the namespace used by trigger/helper functions and remove
-- direct API execution from trigger-only helpers. This is a metadata
-- and privilege-only change; no application rows are modified.
-- ============================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public._bcast_cols_for_status(TEXT) SET search_path = public;
ALTER FUNCTION public.update_ai_configs_updated_at() SET search_path = public;
ALTER FUNCTION public.update_ai_knowledge_documents_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._bcast_cols_for_status(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_ai_configs_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_ai_knowledge_documents_updated_at() FROM PUBLIC, anon, authenticated, service_role;
