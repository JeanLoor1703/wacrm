import { describe, expect, it } from 'vitest'
import { mergeCommercialUpdates, parseCommercialResult } from './commercial'

describe('commercial AI structured updates', () => {
  it('accepts explicit facts and ignores unknown fields', () => {
    const result = parseCommercialResult(JSON.stringify({
      reply: '¿Para qué fecha la necesitas?',
      updates: { work_type: 'Losa', work_location: 'Quevedo', estimated_volume_m3: 22, price: 99, concrete_strength: 'inventada' },
    }))
    expect(result.reply).toContain('fecha')
    expect(result.updates).toEqual({ work_type: 'Losa', work_location: 'Quevedo', estimated_volume_m3: 22 })
  })

  it('rejects invented or invalid volume and preserves human values', () => {
    const result = parseCommercialResult('{"reply":"ok","updates":{"estimated_volume_m3":-4,"needs_pump":"maybe","concrete_strength":"H-210"}}')
    expect(result.updates).toEqual({ concrete_strength: 'H-210' })
    const merged = mergeCommercialUpdates({ work_location: 'Quito', concrete_strength: 'H-180' }, { work_location: 'Guayaquil', concrete_strength: 'H-210', estimated_volume_m3: 8 })
    expect(merged.applied).toEqual({ estimated_volume_m3: 8 })
    expect(merged.conflicts).toEqual(['work_location', 'concrete_strength'])
  })

  it('parses fenced JSON and handoff without exposing chain of thought', () => {
    const result = parseCommercialResult('```json\n{"reply":"Te comunico con un asesor.","updates":{"handoff":true,"handoff_reason":"negociar precio"}}\n```')
    expect(result).toEqual({ reply: 'Te comunico con un asesor.', updates: { handoff: true, handoff_reason: 'negociar precio' } })
  })
})
