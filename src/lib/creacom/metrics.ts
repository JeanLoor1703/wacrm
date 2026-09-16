import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommercialStageKey } from '@/types';
export interface CommercialMetricsData {
  pipeline_count: number;
  stages: Partial<Record<CommercialStageKey, number>>;
  open_count: number;
  open_m3: number;
  negotiation_m3: number;
  won_m3: number;
  sold_m3: number;
  sold_value: number;
  won_missing_actuals: number;
  follow_ups_due: number;
  inactive_open: number;
  pending_open_volume: number;
  pending_negotiation_volume: number;
  pending_won_volume: number;
  currencies: {
    currency: string;
    open_value: number;
    won_value: number;
    sold_value: number;
  }[];
}
export async function loadCommercialMetrics(
  db: SupabaseClient,
  pipelineId?: string
): Promise<CommercialMetricsData> {
  const { data, error } = await db.rpc('creacom_metrics', {
    p_pipeline_id: pipelineId || null,
  });
  if (error || !data)
    throw new Error('No se pudieron consultar las métricas comerciales.');
  return data as CommercialMetricsData;
}
