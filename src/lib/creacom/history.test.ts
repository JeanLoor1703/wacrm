import { expect, it } from 'vitest';
import { summarizeContactDeals } from './history';
import type { Deal } from '@/types';

const deal = (patch: Partial<Deal>): Deal => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  pipeline_id: 'p',
  stage_id: 's',
  contact_id: 'c',
  title: 'Obra',
  value: 0,
  created_at: '',
  ...patch,
});

it('uses confirmed real purchases only and keeps currencies separate', () => {
  const summary = summarizeContactDeals([
    deal({
      status: 'won',
      estimated_volume_m3: 99,
      sale_evidence: 'confirmed_sale',
      actual_volume_m3: 22,
      final_sale_value: 1000,
      currency: 'USD',
      sale_date: '2026-08-12',
    }),
    deal({
      status: 'won',
      sale_evidence: 'possible_historical_sale',
      actual_volume_m3: 50,
      final_sale_value: 3000,
      currency: 'USD',
    }),
    deal({
      status: 'open',
      follow_up_status: 'pending',
      next_follow_up_at: '2026-09-17T14:00:00Z',
    }),
  ]);
  expect(summary.actualVolumeM3).toBe(22);
  expect(summary.soldValues).toEqual([{ currency: 'USD', value: 1000 }]);
  expect(summary.won).toBe(2);
  expect(summary.open).toBe(1);
  expect(summary.nextFollowUpAt).toContain('2026-09-17');
});
