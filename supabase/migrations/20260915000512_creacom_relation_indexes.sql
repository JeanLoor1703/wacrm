-- Cover the composite tenant constraints added by the commercial model.
-- These are deliberately scoped to deals; unrelated legacy advisor findings
-- remain outside Phase 1.
create index deals_pipeline_account on public.deals(pipeline_id, account_id);
create index deals_stage_pipeline on public.deals(stage_id, pipeline_id);
create index deals_contact_account on public.deals(contact_id, account_id) where contact_id is not null;
create index deals_conversation_account on public.deals(conversation_id, account_id) where conversation_id is not null;
create index deals_assignee_account on public.deals(assigned_to, account_id) where assigned_to is not null;
create index deals_reason_account on public.deals(loss_reason_id, account_id) where loss_reason_id is not null;
