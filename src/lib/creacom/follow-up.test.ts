import { expect, it } from 'vitest';
import { followUpDate, isFollowUpDue } from './follow-up';

it('builds tomorrow and next-week presets without sending anything', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  expect(followUpDate('tomorrow', now).slice(0, 10)).toBe('2026-09-16');
  expect(followUpDate('next_week', now).slice(0, 10)).toBe('2026-09-22');
});
it('detects due follow-ups', () =>
  expect(
    isFollowUpDue('2026-09-14T12:00:00Z', new Date('2026-09-15T12:00:00Z'))
  ).toBe(true));
