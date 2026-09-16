import { expect, it, vi } from 'vitest';
import {
  analyzeHistoricalConversation,
  parseHistoricalProposal,
} from './historical-commercial';

it('sorts messages and runs analysis without any sending dependency', async () => {
  const analyze = vi.fn().mockResolvedValue(
    JSON.stringify({
      probable_name: 'Ana',
      probable_company: null,
      mentioned_locations: ['Quevedo'],
      possible_works: [
        {
          title: 'Losa',
          location: 'Quevedo',
          estimated_volume_m3: 25,
          concrete_strength: null,
          quote_requested: true,
        },
      ],
      commercial_intent: 'high',
      probable_status: 'possible_historical_sale',
      possible_purchase: true,
      follow_up_needed: true,
      evidence: ['Necesito 25 metros'],
    })
  );
  const result = await analyzeHistoricalConversation(
    {},
    [
      { sent_at: '2026-02-02', sender: 'agent', text: 'Hola' },
      { sent_at: '2026-02-01', sender: 'customer', text: 'Necesito 25 metros' },
    ],
    analyze
  );
  expect(result.possible_purchase).toBe(true);
  expect(result.probable_status).toBe('possible_historical_sale');
  expect(analyze).toHaveBeenCalledOnce();
  expect(analyze.mock.calls[0][0].indexOf('2026-02-01')).toBeLessThan(
    analyze.mock.calls[0][0].indexOf('2026-02-02')
  );
});

it('falls back to unknown/null instead of inventing malformed values', () => {
  expect(
    parseHistoricalProposal(
      '{"commercial_intent":"certain","possible_works":[{"estimated_volume_m3":-1}]}'
    )
  ).toMatchObject({
    commercial_intent: 'unknown',
    possible_works: [{ estimated_volume_m3: null }],
  });
});
