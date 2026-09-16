'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { COMMERCIAL_STAGES } from '@/lib/creacom/model';
import {
  loadCommercialMetrics,
  type CommercialMetricsData,
} from '@/lib/creacom/metrics';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';

// Intent: advisor sees volumes and commercial outcomes, not weighted guesses.
// Hierarchy/signature: m³ leads, stage ledger follows, money remains per currency.
// Palette/surfaces: CREACOM red labels on white card, muted secondary ledger.
// Depth: existing quiet border. Type: Spartan heading, Inter/tabular figures.
// Spacing: 4px grid, 16px cells, 24px major separation; no decorative charts.
export function CommercialMetrics({
  pipelineId,
  demo = false,
  revision,
  onAvailable,
}: {
  pipelineId?: string;
  demo?: boolean;
  revision?: unknown;
  onAvailable?: (available: boolean) => void;
}) {
  const { accountId } = useAuth();
  const [data, setData] = useState<CommercialMetricsData | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await loadCommercialMetrics(createClient(), pipelineId);
      setData(result);
      setError(false);
      onAvailable?.(result.pipeline_count > 0);
    } catch {
      setError(true);
    }
  }, [pipelineId, onAvailable]);
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void loadCommercialMetrics(createClient(), pipelineId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(false);
          onAvailable?.(result.pipeline_count > 0);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pipelineId, accountId, revision, onAvailable]);
  useRealtime({
    channelName: `commercial-metrics-${pipelineId || 'official'}-${accountId}`,
    enabled: !!accountId,
    onDealEvent: refresh,
  });
  if (error)
    return (
      <div role="alert" className="border-border bg-card rounded-xl border p-4">
        <p>No se pudieron actualizar las métricas comerciales.</p>
        <Button variant="outline" onClick={refresh}>
          Reintentar
        </Button>
      </div>
    );
  if (!data)
    return (
      <div role="status" className="bg-muted rounded-xl p-6">
        Cargando métricas comerciales…
      </div>
    );
  if (!pipelineId && !data.pipeline_count)
    return (
      <p className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm">
        El modelo comercial CREACOM está pendiente de activación. No se incluyen
        datos DEMO.
      </p>
    );
  const volumes = [
    {
      label: 'm³ abiertos',
      value: data.open_m3,
      pending: data.pending_open_volume,
    },
    {
      label: 'm³ en negociación',
      value: data.negotiation_m3,
      pending: data.pending_negotiation_volume,
    },
    {
      label: 'm³ ganados estimados',
      value: data.won_m3,
      pending: data.pending_won_volume,
    },
    {
      label: 'm³ vendidos reales',
      value: data.sold_m3,
      pending: data.won_missing_actuals,
    },
  ];
  return (
    <section
      aria-label="Métricas comerciales CREACOM"
      className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-6"
    >
      <div>
        <p className="text-primary text-xs font-semibold tracking-wider uppercase">
          {demo
            ? 'DEMO · datos de prueba'
            : 'Ventas CREACOM · historial acumulado'}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          Volumen y resultados comerciales
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {demo
            ? 'Este embudo no participa en las métricas oficiales.'
            : 'Todo el historial. Sin pipelines DEMO, conversiones de moneda ni volúmenes inventados.'}
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {volumes.map((v) => (
          <div key={v.label} className="bg-muted/60 rounded-lg p-4">
            <dt className="text-muted-foreground text-sm">{v.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">
              {Number(v.value).toLocaleString('es-EC', {
                maximumFractionDigits: 3,
              })}
            </dd>
            <p className="text-muted-foreground mt-2 text-xs">
              {v.pending} obras con volumen pendiente
            </p>
          </div>
        ))}
      </dl>
      <div className="bg-muted/40 grid gap-3 rounded-lg p-4 text-sm sm:grid-cols-3">
        <p>
          <span className="text-muted-foreground">Seguimientos vencidos</span>
          <br />
          <strong className="tabular-nums">{data.follow_ups_due}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">
            Abiertas sin actividad · 14 días
          </span>
          <br />
          <strong className="tabular-nums">{data.inactive_open}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">
            Ganadas con resultado pendiente
          </span>
          <br />
          <strong className="tabular-nums">{data.won_missing_actuals}</strong>
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
        <div>
          <dt className="text-muted-foreground text-xs">Abiertas</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {data.open_count}
          </dd>
        </div>
        {COMMERCIAL_STAGES.map((s) => (
          <div key={s.semantic_key}>
            <dt className="text-muted-foreground text-xs">
              {s.semantic_key === 'new' ? 'Oportunidades nuevas' : s.name}
            </dt>
            <dd className="text-xl font-semibold tabular-nums">
              {data.stages[s.semantic_key] ?? 0}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-border/50 border-t pt-4">
        <h3 className="text-sm font-semibold">Valor estimado por moneda</h3>
        {data.currencies.length ? (
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            {data.currencies.map((c) => (
              <div key={c.currency}>
                <dt className="text-muted-foreground text-xs">
                  {c.currency} · estimado abierto / estimado ganado / vendido
                  real
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {c.currency === 'UNKNOWN'
                    ? `${c.open_value} / ${c.won_value} / ${c.sold_value} (sin moneda)`
                    : `${formatCurrency(c.open_value, c.currency)} / ${formatCurrency(c.won_value, c.currency)} / ${formatCurrency(c.sold_value, c.currency)}`}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Sin importes registrados.
          </p>
        )}
      </div>
    </section>
  );
}
