import { describe, expect, it } from 'vitest';
import { calculateSegment } from './segments';
import type { Contact, Deal } from '@/types';

const contacts = ['a', 'b', 'c'].map((id) => ({
  id,
  user_id: 'u',
  account_id: 'x',
  phone: id,
  created_at: '',
  updated_at: '',
})) as Contact[];
const deal = (contact_id: string, patch: Partial<Deal>): Deal => ({
  id: `${contact_id}-${Math.random()}`,
  user_id: 'u',
  pipeline_id: 'p',
  stage_id: 's',
  contact_id,
  title: 'Obra',
  value: 0,
  created_at: '',
  ...patch,
});
const deals = [
  deal('a', {
    status: 'won',
    sale_evidence: 'confirmed_sale',
    sale_date: '2026-09-10',
    concrete_strength: 'H-240',
  }),
  deal('a', {
    status: 'won',
    sale_evidence: 'confirmed_sale',
    sale_date: '2026-06-01',
  }),
  deal('b', {
    status: 'won',
    sale_evidence: 'confirmed_sale',
    sale_date: '2026-01-01',
    concrete_strength: 'H-280',
  }),
  deal('c', {
    status: 'open',
    follow_up_status: 'pending',
    next_follow_up_at: '2026-09-20T12:00:00Z',
  }),
];

describe('CRM campaign segments', () => {
  it('finds recent, inactive, strength and recurring buyers from confirmed sales', () => {
    const input = { contacts, deals, now: new Date('2026-09-15T12:00:00Z') };
    expect(calculateSegment('buyers_30_days', input).map((c) => c.id)).toEqual([
      'a',
    ]);
    expect(
      calculateSegment('inactive_buyers_90_days', input).map((c) => c.id)
    ).toEqual(['b']);
    expect(calculateSegment('buyers_h240', input).map((c) => c.id)).toEqual([
      'a',
    ]);
    expect(
      calculateSegment('recurring_builders', input).map((c) => c.id)
    ).toEqual(['a']);
    expect(calculateSegment('follow_up', input).map((c) => c.id)).toEqual([
      'c',
    ]);
  });
  it('does not treat a possible historical sale as a buyer', () => {
    const possible = deal('c', {
      sale_evidence: 'possible_historical_sale',
      sale_date: '2026-09-12',
    });
    expect(
      calculateSegment('buyers_30_days', {
        contacts,
        deals: [possible],
        now: new Date('2026-09-15'),
      })
    ).toEqual([]);
  });
});
