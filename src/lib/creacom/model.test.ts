import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_STAGES,
  opportunityHref,
  pendingFields,
  stageStatus,
  strengthLabel,
  validateOpportunity,
} from './model';
import type { Deal, DealLossReason, PipelineStage } from '@/types';
const stages: PipelineStage[] = COMMERCIAL_STAGES.map((s) => ({
  ...s,
  id: s.semantic_key,
  pipeline_id: 'p',
  created_at: '',
}));
const other: DealLossReason = {
  id: 'r',
  account_id: 'a',
  code: 'other',
  name: 'Otro',
  is_active: true,
  requires_detail: true,
};
const base: Partial<Deal> = {
  title: 'Losa Quevedo',
  contact_id: 'c',
  stage_id: 'new',
  pipeline_id: 'p',
  value: 0,
};
describe('CREACOM progressive opportunity model', () => {
  it('creates with only client, work and stage', () =>
    expect(validateOpportunity(base, stages, [], true)).toBeNull());
  it.each(['title', 'contact_id', 'stage_id'] as const)('requires %s', (key) =>
    expect(
      validateOpportunity({ ...base, [key]: '' }, stages, [], true)
    ).not.toBeNull()
  );
  it('allows two works for one client', () => {
    const works = [
      base,
      { ...base, title: 'Galpón El Empalme', estimated_volume_m3: 60 },
    ];
    expect(
      works.every((d) => validateOpportunity(d, stages, [], true) === null)
    ).toBe(true);
    expect(new Set(works.map((w) => w.contact_id)).size).toBe(1);
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid volume %s', (n) =>
    expect(
      validateOpportunity({ ...base, estimated_volume_m3: n }, stages, [], true)
    ).toMatch(/volumen/)
  );
  it.each([null, 0.001, 25.125])('allows optional positive volume %s', (n) =>
    expect(
      validateOpportunity({ ...base, estimated_volume_m3: n }, stages, [], true)
    ).toBeNull()
  );
  it.each(['H-180', 'H-210', 'H-240', 'H-280', 'unknown'] as const)(
    'accepts %s without guessing',
    (concrete_strength) =>
      expect(
        validateOpportunity({ ...base, concrete_strength }, stages, [], true)
      ).toBeNull()
  );
  it('requires an explanation for other strength', () =>
    expect(
      validateOpportunity(
        { ...base, concrete_strength: 'other' },
        stages,
        [],
        true
      )
    ).toMatch(/resistencia/));
  it('records other strength', () =>
    expect(
      strengthLabel({
        ...base,
        concrete_strength: 'other',
        concrete_strength_other: 'Especificación cliente',
      })
    ).toBe('Especificación cliente'));
  it('never derives delivery date from commercial close', () =>
    expect(
      pendingFields({ ...base, expected_close_date: '2026-09-30' })
    ).toContain('fecha de entrega'));
  it('tracks unknown pump/mixer independently from no', () => {
    expect(
      pendingFields({ ...base, needs_pump: 'no', mixer_access: 'yes' })
    ).not.toContain('bomba');
    expect(pendingFields({ ...base, needs_pump: 'unknown' })).toContain(
      'bomba'
    );
  });
  it.each(COMMERCIAL_STAGES)(
    'manual movement to $name does not require qualification',
    (s) => {
      if (s.semantic_key !== 'not_converted')
        expect(
          validateOpportunity(
            { ...base, stage_id: s.semantic_key },
            stages,
            [],
            true
          )
        ).toBeNull();
    }
  );
  it('requires loss reason before saving', () =>
    expect(
      validateOpportunity(
        { ...base, stage_id: 'not_converted' },
        stages,
        [],
        true
      )
    ).toMatch(/motivo/));
  it('other reason requires detail', () =>
    expect(
      validateOpportunity(
        { ...base, stage_id: 'not_converted', loss_reason_id: 'r' },
        stages,
        [other],
        true
      )
    ).toMatch(/Explica/));
  it('allows a reason with explanation', () =>
    expect(
      validateOpportunity(
        {
          ...base,
          stage_id: 'not_converted',
          loss_reason_id: 'r',
          loss_reason_detail: 'Cambio de diseño',
        },
        stages,
        [other],
        true
      )
    ).toBeNull());
  it('keeps generic WACRM closure compatibility', () =>
    expect(
      validateOpportunity(
        { ...base, stage_id: 'not_converted' },
        stages,
        [],
        false
      )
    ).toBeNull());
  it('rejects a stage from another pipeline', () =>
    expect(
      validateOpportunity({ ...base, pipeline_id: 'else' }, stages, [], true)
    ).toMatch(/embudo/));
  it('stage meanings survive renaming/reordering', () =>
    expect(
      stageStatus({ ...stages[5], name: 'Cerrado', position: 0 }.semantic_key)
    ).toBe('won'));
  it.each([
    ['won', 'won'],
    ['not_converted', 'lost'],
    ['negotiation', 'open'],
    ['new', 'open'],
  ] as const)('maps %s to compatible %s', (key, status) =>
    expect(stageStatus(key)).toBe(status)
  );
  it('reopening has an open outcome', () =>
    expect(stageStatus('qualifying')).toBe('open'));
  it('direct work link encodes IDs', () =>
    expect(opportunityHref({ id: 'd & x', pipeline_id: 'p' })).toBe(
      '/pipelines?pipeline=p&deal=d%20%26%20x'
    ));
  it('edits structured data without losing other fields', () => {
    const original = {
      ...base,
      work_location: 'Quevedo',
      estimated_volume_m3: 25,
      scheduled_date: '2026-09-30',
      needs_pump: 'yes' as const,
    };
    const edited = { ...original, estimated_volume_m3: 30 };
    expect(edited.work_location).toBe('Quevedo');
    expect(edited.needs_pump).toBe('yes');
  });
  it.each([-1, NaN, Infinity])('rejects invalid value %s', (value) =>
    expect(validateOpportunity({ ...base, value }, stages, [], true)).toMatch(
      /valor/
    )
  );
  it('keeps estimated and real results separate', () => {
    expect(validateOpportunity({ ...base, stage_id: 'won', estimated_volume_m3: 25, actual_volume_m3: 22, final_sale_value: 1200, sale_date: '2026-09-15', sale_evidence: 'confirmed_sale' }, stages, [], true)).toBeNull();
  });
  it('requires complete actuals only when confirming a sale', () => {
    expect(validateOpportunity({ ...base, sale_evidence: 'confirmed_sale' }, stages, [], true)).toMatch(/volumen real/);
    expect(validateOpportunity({ ...base, sale_evidence: 'possible_historical_sale' }, stages, [], true)).toBeNull();
  });
  it('requires both date and status for follow-up', () =>
    expect(validateOpportunity({ ...base, next_follow_up_at: '2026-09-16T14:00:00Z' }, stages, [], true)).toMatch(/seguimiento/));
});
