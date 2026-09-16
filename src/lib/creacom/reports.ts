import type { SupabaseClient } from '@supabase/supabase-js';

export type CommercialReportGroup =
  | 'client'
  | 'company'
  | 'period'
  | 'strength'
  | 'location'
  | 'source'
  | 'stage'
  | 'loss_reason';
export interface CommercialReportRow {
  label: string;
  actual_volume_m3: number;
  final_sale_value: number;
  opportunities: number;
}

export async function loadCommercialReport(
  db: SupabaseClient,
  groupBy: CommercialReportGroup,
  from?: string,
  to?: string
): Promise<CommercialReportRow[]> {
  const { data, error } = await db.rpc('creacom_report', {
    p_group_by: groupBy,
    p_from: from || null,
    p_to: to || null,
  });
  if (error) throw new Error('No se pudo generar el reporte comercial.');
  return (data ?? []) as CommercialReportRow[];
}
