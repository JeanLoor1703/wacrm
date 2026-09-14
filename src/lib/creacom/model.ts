import type {
  CommercialStageKey,
  ConcreteStrength,
  Deal,
  DealLossReason,
  DealStatus,
  PipelineStage,
  UnknownBoolean,
} from '@/types';

export const COMMERCIAL_STAGES: {
  semantic_key: CommercialStageKey;
  name: string;
  color: string;
  position: number;
}[] = [
  { semantic_key: 'new', name: 'Nuevo', color: '#4D4D4F', position: 0 },
  {
    semantic_key: 'qualifying',
    name: 'Calificando',
    color: '#697586',
    position: 1,
  },
  {
    semantic_key: 'ready_to_quote',
    name: 'Listo para cotizar',
    color: '#D97706',
    position: 2,
  },
  {
    semantic_key: 'quote_sent',
    name: 'Cotización enviada',
    color: '#ED3237',
    position: 3,
  },
  {
    semantic_key: 'negotiation',
    name: 'Negociación',
    color: '#B91C1C',
    position: 4,
  },
  { semantic_key: 'won', name: 'Ganado', color: '#15803D', position: 5 },
  {
    semantic_key: 'not_converted',
    name: 'No concretado',
    color: '#747474',
    position: 6,
  },
];
export const STRENGTHS: { value: ConcreteStrength; label: string }[] = [
  ...(['H-180', 'H-210', 'H-240', 'H-280'] as const).map((value) => ({
    value,
    label: value,
  })),
  { value: 'other', label: 'Otro' },
  { value: 'unknown', label: 'Por confirmar' },
];
export const TRI_STATES: { value: UnknownBoolean; label: string }[] = [
  { value: 'unknown', label: 'Por confirmar' },
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
];
export function stageStatus(key?: CommercialStageKey | null): DealStatus {
  return key === 'won' ? 'won' : key === 'not_converted' ? 'lost' : 'open';
}
export function strengthLabel(
  deal: Pick<Deal, 'concrete_strength' | 'concrete_strength_other'>
): string {
  return deal.concrete_strength === 'other'
    ? deal.concrete_strength_other || 'Otro'
    : STRENGTHS.find((s) => s.value === deal.concrete_strength)?.label ||
        'Por confirmar';
}
export function pendingFields(deal: Partial<Deal>): string[] {
  const result: string[] = [];
  if (!deal.work_location?.trim()) result.push('ubicación');
  if (!deal.work_type?.trim()) result.push('tipo de obra');
  if (deal.estimated_volume_m3 == null) result.push('volumen');
  if (!deal.concrete_strength || deal.concrete_strength === 'unknown')
    result.push('resistencia');
  if (!deal.scheduled_date) result.push('fecha de entrega');
  if (!deal.needs_pump || deal.needs_pump === 'unknown') result.push('bomba');
  if (!deal.mixer_access || deal.mixer_access === 'unknown')
    result.push('acceso mixer');
  return result;
}
export function validateOpportunity(
  deal: Partial<Deal>,
  stages: PipelineStage[],
  reasons: DealLossReason[],
  commercial: boolean
): string | null {
  if (!deal.title?.trim() || !deal.contact_id || !deal.stage_id)
    return 'Selecciona cliente, obra y etapa.';
  const stage = stages.find((s) => s.id === deal.stage_id);
  if (!stage || stage.pipeline_id !== deal.pipeline_id)
    return 'Selecciona una etapa de este embudo.';
  if (!Number.isFinite(deal.value ?? 0) || (deal.value ?? 0) < 0)
    return 'El valor estimado debe ser cero o mayor.';
  if (
    deal.estimated_volume_m3 != null &&
    (!Number.isFinite(deal.estimated_volume_m3) ||
      deal.estimated_volume_m3 <= 0)
  )
    return 'El volumen debe ser mayor que cero.';
  if (
    deal.concrete_strength === 'other' &&
    !deal.concrete_strength_other?.trim()
  )
    return 'Describe la resistencia indicada por el cliente.';
  if (commercial && stage.semantic_key === 'not_converted') {
    const reason = reasons.find((r) => r.id === deal.loss_reason_id);
    if (!reason) return 'Selecciona el motivo de no concretado.';
    if (reason.requires_detail && !deal.loss_reason_detail?.trim())
      return 'Explica el motivo de no concretado.';
  }
  return null;
}
export function opportunityHref(
  deal: Pick<Deal, 'id' | 'pipeline_id'>
): string {
  return `/pipelines?pipeline=${encodeURIComponent(deal.pipeline_id)}&deal=${encodeURIComponent(deal.id)}`;
}
