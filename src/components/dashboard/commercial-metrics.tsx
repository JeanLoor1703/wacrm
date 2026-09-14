'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { COMMERCIAL_STAGES } from '@/lib/creacom/model';
import { loadCommercialMetrics, type CommercialMetricsData } from '@/lib/creacom/metrics';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';

// Intent: advisor sees volumes and commercial outcomes, not weighted guesses.
// Hierarchy/signature: m³ leads, stage ledger follows, money remains per currency.
// Palette/surfaces: CREACOM red labels on white card, muted secondary ledger.
// Depth: existing quiet border. Type: Spartan heading, Inter/tabular figures.
// Spacing: 4px grid, 16px cells, 24px major separation; no decorative charts.
export function CommercialMetrics({ pipelineId, demo = false, revision }: { pipelineId?: string; demo?: boolean; revision?: unknown }) {
  const { accountId } = useAuth();
  const [data, setData] = useState<CommercialMetricsData | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try { const result = await loadCommercialMetrics(createClient(), pipelineId); setData(result); setError(false); }
    catch { setError(true); }
  }, [pipelineId]);
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void loadCommercialMetrics(createClient(), pipelineId).then(result => {
      if (!cancelled) { setData(result); setError(false); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [pipelineId, accountId, revision]);
  useRealtime({ channelName: `commercial-metrics-${pipelineId || 'official'}-${accountId}`, enabled: !!accountId, onDealEvent: refresh });
  if (error) return <div role="alert" className="rounded-xl border border-border bg-card p-4"><p>No se pudieron actualizar las métricas comerciales.</p><Button variant="outline" onClick={refresh}>Reintentar</Button></div>;
  if (!data) return <div role="status" className="rounded-xl bg-muted p-6">Cargando métricas comerciales…</div>;
  if (!pipelineId && !data.pipeline_count) return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">El modelo comercial CREACOM está pendiente de activación. No se incluyen datos DEMO.</p>;
  const volumes = [
    { label: 'm³ abiertos', value: data.open_m3, pending: data.pending_open_volume },
    { label: 'm³ en negociación', value: data.negotiation_m3, pending: data.pending_negotiation_volume },
    { label: 'm³ ganados', value: data.won_m3, pending: data.pending_won_volume },
  ];
  return <section aria-label="Métricas comerciales CREACOM" className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{demo ? 'DEMO · datos de prueba' : 'Ventas CREACOM · historial acumulado'}</p><h2 className="mt-1 text-xl font-bold">Volumen y resultados comerciales</h2><p className="mt-1 text-xs text-muted-foreground">{demo ? 'Este embudo no participa en las métricas oficiales.' : 'Todo el historial. Sin pipelines DEMO, conversiones de moneda ni volúmenes inventados.'}</p></div>
    <dl className="grid gap-4 sm:grid-cols-3">{volumes.map(v => <div key={v.label} className="rounded-lg bg-muted/60 p-4"><dt className="text-sm text-muted-foreground">{v.label}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{Number(v.value).toLocaleString('es-EC', { maximumFractionDigits: 3 })}</dd><p className="mt-2 text-xs text-muted-foreground">{v.pending} obras con volumen pendiente</p></div>)}</dl>
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
      <div><dt className="text-xs text-muted-foreground">Abiertas</dt><dd className="text-xl font-semibold tabular-nums">{data.open_count}</dd></div>
      {COMMERCIAL_STAGES.map(s => <div key={s.semantic_key}><dt className="text-xs text-muted-foreground">{s.semantic_key === 'new' ? 'Oportunidades nuevas' : s.name}</dt><dd className="text-xl font-semibold tabular-nums">{data.stages[s.semantic_key] ?? 0}</dd></div>)}
    </dl>
    <div className="border-t border-border/50 pt-4"><h3 className="text-sm font-semibold">Valor estimado por moneda</h3>{data.currencies.length ? <dl className="mt-3 grid gap-4 sm:grid-cols-2">{data.currencies.map(c => <div key={c.currency}><dt className="text-xs text-muted-foreground">{c.currency} · abierto / ganado</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{c.currency === 'UNKNOWN' ? `${c.open_value} / ${c.won_value} (sin moneda)` : `${formatCurrency(c.open_value, c.currency)} / ${formatCurrency(c.won_value, c.currency)}`}</dd></div>)}</dl> : <p className="mt-2 text-sm text-muted-foreground">Sin importes registrados.</p>}</div>
  </section>;
}
