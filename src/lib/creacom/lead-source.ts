import type { LeadSource } from '@/types';

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'whatsapp_direct', label: 'WhatsApp directo' },
  { value: 'website', label: 'Página web' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'referral', label: 'Referido' },
  { value: 'recurring_customer', label: 'Cliente recurrente' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Otro' },
  { value: 'unknown', label: 'Desconocido' },
];

export function leadSourceLabel(source?: LeadSource | null): string {
  return (
    LEAD_SOURCES.find((item) => item.value === source)?.label ?? 'Desconocido'
  );
}
