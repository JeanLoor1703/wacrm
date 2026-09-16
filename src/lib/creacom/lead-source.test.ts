import { describe, expect, it } from 'vitest';
import { LEAD_SOURCES, leadSourceLabel } from './lead-source';

describe('lead source', () => {
  it('contains the extensible initial catalog with friendly labels', () => {
    expect(LEAD_SOURCES.map((item) => item.value)).toContain('facebook_ads');
    expect(leadSourceLabel('whatsapp_direct')).toBe('WhatsApp directo');
  });
  it('never invents a missing source', () =>
    expect(leadSourceLabel(null)).toBe('Desconocido'));
});
