-- ============================================================
-- 040_harden_function_execute_privileges.sql
--
-- Supabase exposes functions in the public schema through RPC when
-- an API role has EXECUTE. Several trigger-only and server-only
-- SECURITY DEFINER helpers had inherited direct EXECUTE grants for
-- anon/authenticated roles in production. Their bodies deliberately
-- bypass RLS, so callers must be restricted to the roles that own the
-- corresponding workflow.
--
-- This migration changes privileges only. It does not update rows or
-- alter the commercial schema.
-- ============================================================

-- Trigger-only and one-time maintenance helpers: never direct RPCs.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._bcast_bump(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.broadcast_recipient_aggregate_trigger() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_conversation_assigned() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.merge_duplicate_contacts() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.merge_duplicate_conversations() FROM PUBLIC, anon, authenticated, service_role;

-- Server-side operational RPCs.
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.record_webhook_failure(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_webhook_failure(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.recompute_broadcast_counts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_broadcast_counts(UUID) TO service_role;

-- Account-aware browser RPCs. Their bodies validate auth.uid(), role,
-- account membership, and target membership; anonymous access is not
-- part of the intended contract.
REVOKE ALL ON FUNCTION public.is_account_member(UUID, public.account_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, public.account_role_enum) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.touch_presence(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_presence(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_member_role(UUID, public.account_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(UUID, public.account_role_enum) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.remove_account_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transfer_account_ownership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_account_ownership(UUID) TO authenticated, service_role;

-- peek_invitation(TEXT) intentionally remains executable by anon and
-- authenticated so an invitation landing page can be rendered before
-- the visitor signs in. It only returns non-sensitive invitation
-- metadata and never mutates data.
