'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DealLossReason } from '@/types';
import { toast } from 'sonner';

// Intent: administrator extends/deactivates reasons without erasing history.
// Hierarchy: catalog names before controls. Existing white/muted surfaces, red
// primary action; quiet borders, Inter 14px, 4px rhythm/16px section spacing.
export function LossReasons() {
  const db = createClient(); const { accountId } = useAuth(); const canEdit = useCan('edit-settings');
  const [reasons,setReasons] = useState<DealLossReason[]>([]); const [name,setName] = useState('');
  const [detail,setDetail] = useState(false); const [busy,setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!accountId) return;
    const {data,error} = await db.from('deal_loss_reasons').select('*').eq('account_id',accountId).order('name');
    if (error) toast.error('No se pudo cargar el catálogo de motivos.'); else setReasons(data ?? []);
  },[accountId,db]);
  useEffect(() => {
    if (!accountId) return;
    let cancelled=false;
    void db.from('deal_loss_reasons').select('*').eq('account_id',accountId).order('name').then(({data,error}) => {
      if (cancelled) return;
      if (error) toast.error('No se pudo cargar el catálogo de motivos.'); else setReasons(data ?? []);
    });
    return () => {cancelled=true;};
  },[accountId,db]);
  async function save(reason?: DealLossReason) {
    if (!accountId || !canEdit || busy) return;
    setBusy(true);
    const result = reason ? await db.from('deal_loss_reasons').update({is_active:!reason.is_active}).eq('id',reason.id).select('id').single() :
      await db.from('deal_loss_reasons').insert({account_id:accountId,code:`custom_${crypto.randomUUID()}`,name:name.trim(),requires_detail:detail}).select('id').single();
    if (result.error) toast.error('No se pudo guardar el motivo.'); else {setName('');setDetail(false); await load();}
    setBusy(false);
  }
  return <section className="space-y-3 border-t border-border/50 pt-4"><h3 className="text-sm font-semibold">Motivos de no concretado</h3><p className="text-xs text-muted-foreground">Desactivar no elimina el motivo de las obras anteriores.</p>
    <ul className="space-y-2">{reasons.map(r => <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><span>{r.name}{!r.is_active ? ' · inactivo' : ''}</span><Button size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => save(r)}>{r.is_active ? 'Desactivar' : 'Activar'}</Button></li>)}</ul>
    {canEdit && <><Label htmlFor="loss-new-name">Nuevo motivo</Label><Input id="loss-new-name" value={name} onChange={e => setName(e.target.value)} /><Label className="flex items-center gap-2"><input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} />Exigir explicación</Label><Button disabled={busy || !name.trim()} onClick={() => save()}>Añadir motivo</Button></>}
  </section>;
}
