'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  calculateSegment,
  type CampaignSegmentKey,
} from '@/lib/creacom/segments';
import type { Contact, Deal } from '@/types';

const SEGMENTS: { key: CampaignSegmentKey; label: string }[] = [
  { key: 'buyers_30_days', label: 'Compradores últimos 30 días' },
  { key: 'buyers_90_days', label: 'Compradores últimos 90 días' },
  { key: 'inactive_buyers_90_days', label: 'Sin comprar hace más de 90 días' },
  { key: 'quoted_not_bought', label: 'Cotizaron y no compraron' },
  { key: 'buyers_h240', label: 'Compradores H-240' },
  { key: 'buyers_h280', label: 'Compradores H-280' },
  { key: 'recurring_builders', label: 'Constructores recurrentes' },
  { key: 'lost_by_price', label: 'No concretado por precio' },
  { key: 'follow_up', label: 'Oportunidades en seguimiento' },
];

export function CrmSegmentsPanel() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const db = createClient();
    void Promise.all([
      db.from('contacts').select('*'),
      db
        .from('deals')
        .select('*, stage:pipeline_stages!deals_stage_id_fkey(*)'),
      db
        .from('deal_loss_reasons')
        .select('id')
        .eq('code', 'price')
        .maybeSingle(),
    ]).then(([contactsResult, dealsResult, priceResult]) => {
      if (cancelled || contactsResult.error || dealsResult.error) return;
      const input = {
        contacts: (contactsResult.data ?? []) as Contact[],
        deals: (dealsResult.data ?? []) as Deal[],
        priceLossReasonId: priceResult.data?.id,
      };
      setCounts(
        Object.fromEntries(
          SEGMENTS.map((segment) => [
            segment.key,
            calculateSegment(segment.key, input).length,
          ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="border-border bg-card rounded-xl border p-4 sm:p-5"
      aria-label="Segmentos CRM"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Segmentos comerciales disponibles</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Destinatarios calculados con compras confirmadas y oportunidades
            reales. La ubicación se define al crear el borrador.
          </p>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
          Sólo planificación
        </span>
      </div>
      <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENTS.map((segment) => (
          <div
            key={segment.key}
            className="border-border/50 flex items-center justify-between gap-3 border-b pb-2"
          >
            <dt className="text-sm">{segment.label}</dt>
            <dd className="font-semibold tabular-nums">
              {counts ? counts[segment.key] : '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
