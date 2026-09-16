-- Fase 2: IA comercial CREACOM.
-- Compatible con instalaciones existentes: no toca WhatsApp, Meta ni otros pipelines.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ai_configs'::regclass
      AND conname = 'ai_configs_provider_check'
  ) THEN
    ALTER TABLE public.ai_configs DROP CONSTRAINT ai_configs_provider_check;
  END IF;
END $$;

ALTER TABLE public.ai_configs
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD CONSTRAINT ai_configs_provider_check CHECK (provider IN ('openai', 'anthropic', 'groq'));

ALTER TABLE public.ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_provider_check;
ALTER TABLE public.ai_usage_log
  ADD CONSTRAINT ai_usage_log_provider_check CHECK (provider IN ('openai', 'anthropic', 'groq'));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_handoff_state text NOT NULL DEFAULT 'AI_ACTIVE'
    CHECK (ai_handoff_state IN ('AI_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_ACTIVE')),
  ADD COLUMN IF NOT EXISTS ai_handoff_reason text,
  ADD COLUMN IF NOT EXISTS ai_handoff_requested_at timestamptz;

UPDATE public.conversations
SET ai_handoff_state = CASE
  WHEN ai_autoreply_disabled AND assigned_agent_id IS NOT NULL THEN 'HUMAN_ACTIVE'
  WHEN ai_autoreply_disabled THEN 'HUMAN_REQUESTED'
  ELSE 'AI_ACTIVE'
END
WHERE ai_handoff_state = 'AI_ACTIVE';

CREATE TABLE IF NOT EXISTS public.ai_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  origin text NOT NULL CHECK (origin IN ('ai', 'human', 'system')),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_change_log_account_created
  ON public.ai_change_log(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_change_log_deal_created
  ON public.ai_change_log(deal_id, created_at DESC);

ALTER TABLE public.ai_change_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ai_change_log TO authenticated;
GRANT ALL ON public.ai_change_log TO service_role;
REVOKE ALL ON public.ai_change_log FROM anon;

DROP POLICY IF EXISTS ai_change_log_select ON public.ai_change_log;
CREATE POLICY ai_change_log_select ON public.ai_change_log FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS ai_change_log_insert ON public.ai_change_log;
CREATE POLICY ai_change_log_insert ON public.ai_change_log FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id, 'agent') AND origin = 'ai');

COMMENT ON TABLE public.ai_change_log IS
  'Append-only audit of structured AI opportunity updates; never stores prompts, secrets, or chain of thought.';
