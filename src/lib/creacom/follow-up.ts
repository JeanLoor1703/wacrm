export type FollowUpPreset = 'tomorrow' | 'next_week';

export function followUpDate(preset: FollowUpPreset, now = new Date()): string {
  const result = new Date(now);
  result.setHours(9, 0, 0, 0);
  result.setDate(result.getDate() + (preset === 'tomorrow' ? 1 : 7));
  return result.toISOString();
}

export function isFollowUpDue(
  value?: string | null,
  now = new Date()
): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed <= now;
}
