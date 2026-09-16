import type { SupabaseClient } from '@supabase/supabase-js';

export type CommercialEventType =
  | 'contact_created'
  | 'deal_created'
  | 'deal_qualified'
  | 'ready_to_quote'
  | 'quote_sent'
  | 'deal_won'
  | 'deal_lost'
  | 'follow_up_due';

export async function recordCommercialEvent(
  db: SupabaseClient,
  event: {
    account_id: string;
    event_type: CommercialEventType;
    aggregate_type: 'contact' | 'deal';
    aggregate_id: string;
    actor_type: 'human' | 'ai' | 'system';
    actor_user_id?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await db
    .from('domain_events')
    .insert({ ...event, payload: event.payload ?? {} });
  if (error) throw new Error('No se pudo registrar el evento comercial.');
}
