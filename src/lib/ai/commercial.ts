import type { Deal, UnknownBoolean, ConcreteStrength } from '@/types'

export const AI_OPPORTUNITY_FIELDS = [
  'work_type',
  'work_location',
  'concrete_strength',
  'concrete_strength_other',
  'estimated_volume_m3',
  'scheduled_date',
  'needs_pump',
  'mixer_access',
  'title',
  'notes',
] as const

export type AiOpportunityField = (typeof AI_OPPORTUNITY_FIELDS)[number]
export type CommercialUpdates = Partial<Record<AiOpportunityField, unknown>> & {
  contact_name?: unknown
  stage_key?: unknown
  handoff?: unknown
  handoff_reason?: unknown
}

export interface CommercialResult {
  reply: string
  updates: CommercialUpdates
}

const strengths = new Set<ConcreteStrength>(['H-180', 'H-210', 'H-240', 'H-280', 'other', 'unknown'])
const tri = new Set<UnknownBoolean>(['yes', 'no', 'unknown'])
const allowed = new Set<string>([...AI_OPPORTUNITY_FIELDS, 'contact_name', 'stage_key', 'handoff', 'handoff_reason'])

function unwrapJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) } catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { return null } }
    return null
  }
}

/** Parse and validate the model's structured output. Unknown keys are ignored. */
export function parseCommercialResult(raw: string): CommercialResult {
  const value = unwrapJson(raw)
  if (!value || typeof value !== 'object') return { reply: '', updates: {} }
  const obj = value as Record<string, unknown>
  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : ''
  const source = obj.updates && typeof obj.updates === 'object' ? obj.updates as Record<string, unknown> : {}
  const updates: CommercialUpdates = {}
  for (const [key, rawValue] of Object.entries(source)) {
    if (!allowed.has(key) || rawValue === null || rawValue === undefined) continue
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue
    if (value === '') continue
    if (key === 'estimated_volume_m3') {
      const n = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(n) && n > 0) updates.estimated_volume_m3 = n
      continue
    }
    if (key === 'concrete_strength') { if (typeof value === 'string' && strengths.has(value as ConcreteStrength)) updates[key] = value; continue }
    if (key === 'needs_pump' || key === 'mixer_access') { if (typeof value === 'string' && tri.has(value as UnknownBoolean)) updates[key] = value; continue }
    if (key === 'stage_key') { if (typeof value === 'string' && ['new', 'qualifying', 'ready_to_quote', 'quote_sent', 'negotiation'].includes(value)) updates.stage_key = value; continue }
    if (key === 'handoff' && typeof value === 'boolean') { updates.handoff = value; continue }
    if (typeof value === 'string') updates[key as keyof CommercialUpdates] = value
  }
  return { reply, updates }
}

/** Only fill empty/unknown fields. Existing human-confirmed values win. */
export function mergeCommercialUpdates(current: Partial<Deal>, updates: CommercialUpdates) {
  const applied: Record<string, unknown> = {}
  const conflicts: string[] = []
  for (const field of AI_OPPORTUNITY_FIELDS) {
    const incoming = updates[field]
    if (incoming === undefined) continue
    const existing = current[field]
    const empty = existing === undefined || existing === null || existing === '' || existing === 'unknown'
    if (empty) applied[field] = incoming
    else if (String(existing) !== String(incoming)) conflicts.push(field)
  }
  return { applied, conflicts }
}

export function commercialSystemPrompt(base: string | null, current: Partial<Deal>): string {
  return [
    'Eres el asistente comercial interno de CREACOM Hormigonera.',
    'Devuelve ÚNICAMENTE JSON válido con esta forma: {"reply":"mensaje breve","updates":{}}.',
    'Extrae sólo datos explícitos del último mensaje. Si un dato no está escrito, omítelo; nunca inventes resistencia, volumen, precio, fecha, disponibilidad o condiciones.',
    'updates admite work_type, work_location, concrete_strength (H-180/H-210/H-240/H-280/other/unknown), concrete_strength_other, estimated_volume_m3, scheduled_date (YYYY-MM-DD), needs_pump (yes/no/unknown), mixer_access (yes/no/unknown), title, notes, contact_name, stage_key (new/qualifying/ready_to_quote/quote_sent/negotiation), handoff (boolean) y handoff_reason.',
    'No cambies ganada ni no concretada. Pregunta sólo por el siguiente dato relevante que falta. Para precio, descuento, crédito, reclamo, excepción o petición de una persona, establece handoff=true.',
    `Datos actuales (no los repitas como nuevos): ${JSON.stringify(current)}`,
    base?.trim() ? `Contexto aprobado de la empresa:\n${base.trim()}` : '',
  ].filter(Boolean).join('\n\n')
}
