"use client";

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { CURRENCIES } from '@/lib/currency';
import { pendingFields, stageStatus, STRENGTHS, TRI_STATES, validateOpportunity } from '@/lib/creacom/model';
import type { Contact, ConcreteStrength, Deal, DealLossReason, DealStatus, PipelineStage, Profile, UnknownBoolean } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface DealFormProps {
  open: boolean; onOpenChange: (open: boolean) => void; deal?: Deal | null;
  pipelineId: string; stages: PipelineStage[]; defaultStageId?: string;
  requestedStageId?: string; commercial?: boolean; onSaved: () => void;
}
interface Draft {
  title: string; value: string; currency: string; contact_id: string; stage_id: string;
  assigned_to: string; expected_close_date: string; notes: string; work_type: string;
  work_location: string; concrete_strength: ConcreteStrength; concrete_strength_other: string;
  estimated_volume_m3: string; scheduled_date: string; needs_pump: UnknownBoolean;
  mixer_access: UnknownBoolean; loss_reason_id: string; loss_reason_detail: string;
}
const selectClass = 'h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary';
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="grid content-start gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

// Intent: advisor records confirmed work details between calls; work/client lead.
// Palette/surfaces: existing white card, industrial muted inputs, red actions.
// Depth: quiet borders. Type: Spartan heading/Inter 14px; spacing: 4px grid,
// 16px field gaps, internal scroll and fixed footer rather than a long page.
export function DealForm({ open, onOpenChange, deal, pipelineId, stages, defaultStageId, requestedStageId, commercial = false, onSaved }: DealFormProps) {
  const t = useTranslations('Pipelines.form');
  const db = createClient();
  const { accountId, defaultCurrency } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<string>('commercial');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reasons, setReasons] = useState<DealLossReason[]>([]);
  const [hasConversation, setHasConversation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const firstStageId = stages[0]?.id || '';
  useEffect(() => {
    if (!open) return;
    setDraft({
      title: deal?.title ?? '', value: deal ? String(deal.value ?? 0) : '', currency: deal?.currency || defaultCurrency,
      contact_id: deal?.contact_id ?? '', stage_id: requestedStageId || deal?.stage_id || defaultStageId || firstStageId,
      assigned_to: deal?.assigned_to ?? '', expected_close_date: deal?.expected_close_date ?? '', notes: deal?.notes ?? '',
      work_type: deal?.work_type ?? '', work_location: deal?.work_location ?? '',
      concrete_strength: deal?.concrete_strength ?? 'unknown', concrete_strength_other: deal?.concrete_strength_other ?? '',
      estimated_volume_m3: deal?.estimated_volume_m3 == null ? '' : String(deal.estimated_volume_m3),
      scheduled_date: deal?.scheduled_date ?? '', needs_pump: deal?.needs_pump ?? 'unknown', mixer_access: deal?.mixer_access ?? 'unknown',
      loss_reason_id: deal?.loss_reason_id ?? '', loss_reason_detail: deal?.loss_reason_detail ?? '',
    });
    setTab(requestedStageId ? 'sale' : 'commercial'); setError(null); setConfirmDelete(false);
  }, [open, deal, pipelineId, defaultStageId, requestedStageId, defaultCurrency, firstStageId]);

  useEffect(() => {
    if (!open || !accountId) return;
    let cancelled = false;
    void Promise.all([
      db.from('contacts').select('*').eq('account_id', accountId).order('name'),
      db.from('profiles').select('*').eq('account_id', accountId).order('full_name'),
      commercial ? db.from('deal_loss_reasons').select('*').eq('account_id', accountId).order('name') : Promise.resolve({ data: [], error: null }),
    ]).then(([c, p, r]) => {
      if (cancelled) return;
      setContacts(c.data ?? []); setProfiles(p.data ?? []); setReasons(r.data ?? []);
      if (c.error || p.error || r.error) setError('No se pudieron cargar los clientes, asesores o motivos. Cierra y vuelve a abrir la obra.');
    });
    return () => { cancelled = true; };
  }, [open, accountId, commercial, db]);
  useEffect(() => {
    if (!open || !draft?.contact_id) return;
    let cancelled = false;
    void db.from('conversations').select('id').eq('contact_id', draft.contact_id).limit(1).then(({ data }) => {
      if (!cancelled) setHasConversation(!!data?.length);
    });
    return () => { cancelled = true; };
  }, [open, draft?.contact_id, db]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev); setError(null);
  }
  async function handleSave() {
    if (!draft || saving) return;
    const payload = {
      ...draft, pipeline_id: pipelineId, title: draft.title.trim(), value: draft.value.trim() ? Number(draft.value) : 0,
      assigned_to: draft.assigned_to || null, expected_close_date: draft.expected_close_date || null,
      work_type: draft.work_type.trim() || null, work_location: draft.work_location.trim() || null,
      concrete_strength_other: draft.concrete_strength_other.trim() || null,
      estimated_volume_m3: draft.estimated_volume_m3.trim() ? Number(draft.estimated_volume_m3) : null,
      scheduled_date: draft.scheduled_date || null, notes: draft.notes.trim() || null,
      loss_reason_id: draft.loss_reason_id || null, loss_reason_detail: draft.loss_reason_detail.trim() || null,
    };
    const validation = validateOpportunity(payload as Partial<Deal>, stages, reasons, commercial);
    if (validation) { setError(validation); setTab(!payload.title || !payload.contact_id ? 'commercial' : validation.includes('volumen') || validation.includes('resistencia') ? 'concrete' : 'sale'); return; }
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user || !accountId) throw new Error('Necesitas una sesión activa para guardar.');
      const result = deal
        ? await db.from('deals').update(payload).eq('id', deal.id).eq('account_id', accountId).select('id').single()
        : await db.from('deals').insert({ ...payload, user_id: user.id, account_id: accountId, status: 'open' }).select('id').single();
      if (result.error) throw new Error('No se pudo guardar. Revisa la etapa y el motivo, o vuelve a intentarlo.');
      toast.success(deal ? t('toastUpdated') : t('toastCreated')); onSaved(); onOpenChange(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }
  async function handleStatus(status: DealStatus) {
    if (!deal || saving) return;
    if (commercial) {
      const target = stages.find(s => stageStatus(s.semantic_key) === status);
      if (target) { change('stage_id', target.id); setTab('sale'); }
      return;
    }
    setSaving(true);
    const { error } = await db.from('deals').update({ status }).eq('id', deal.id).select('id').single();
    setSaving(false);
    if (error) { setError(t('toastFailedStatus')); return; }
    onSaved(); onOpenChange(false);
  }
  async function handleDelete() {
    if (!deal || saving) return;
    setSaving(true);
    const { error } = await db.from('deals').delete().eq('id', deal.id).select('id').single();
    setSaving(false);
    if (error) { setError(t('toastFailedDelete')); return; }
    toast.success(t('toastDeleted')); onSaved(); onOpenChange(false);
  }
  const currentStage = stages.find(s => s.id === draft?.stage_id);
  const losing = commercial && currentStage?.semantic_key === 'not_converted';
  const pending = draft ? pendingFields({ ...draft, value: Number(draft.value), estimated_volume_m3: draft.estimated_volume_m3 ? Number(draft.estimated_volume_m3) : null }) : [];
  const textField = (key: keyof Draft, label: string, type = 'text') => <Field id={`work-${key}`} label={label}><Input id={`work-${key}`} type={type} value={draft?.[key] ?? ''} onChange={e => change(key, e.target.value)} className="bg-muted" step={type === 'number' ? 'any' : undefined} /></Field>;
  return <Sheet open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}>
    <SheetContent side="right" className="bg-popover w-full p-0 sm:max-w-2xl">
      <SheetHeader className="shrink-0 border-b border-border/50 p-4 pr-12">
        <SheetTitle>{commercial ? (deal ? 'Editar obra / oportunidad' : 'Nueva obra / oportunidad') : deal ? t('editDeal') : t('newDeal')}</SheetTitle>
        <SheetDescription>{commercial ? 'Registra lo confirmado por el cliente. Puedes completar los datos después.' : 'Gestiona la oportunidad comercial.'}</SheetDescription>
      </SheetHeader>
      {draft && <>
        <Tabs value={tab} onValueChange={v => setTab(String(v))} className="min-h-0 flex-1 gap-0">
          <TabsList className="m-4 grid h-11 w-auto shrink-0 grid-cols-3" aria-label="Datos de la oportunidad">
            <TabsTrigger value="commercial" className="whitespace-normal text-xs sm:text-sm">Información comercial</TabsTrigger>
            <TabsTrigger value="concrete">Hormigón</TabsTrigger>
            <TabsTrigger value="sale">Venta</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <TabsContent value="commercial" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="work-contact_id" label="Cliente *"><select id="work-contact_id" value={draft.contact_id} onChange={e => change('contact_id', e.target.value)} className={selectClass}><option value="">Seleccionar cliente</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}</select></Field>
                {textField('title', 'Obra / referencia *')}
                {textField('work_location', 'Ubicación de la obra')}
                {textField('work_type', 'Tipo de obra')}
              </div>
              {draft.contact_id && hasConversation && <Link href="/inbox" className="inline-flex items-center gap-2 text-sm text-primary underline"><MessageSquare className="size-4" />Ver conversaciones</Link>}
              {commercial && pending.length > 0 && <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">Por confirmar: {pending.join(', ')}. No impide mover la obra manualmente.</p>}
            </TabsContent>
            <TabsContent value="concrete" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="work-strength" label="Resistencia"><select id="work-strength" className={selectClass} value={draft.concrete_strength} onChange={e => change('concrete_strength', e.target.value as ConcreteStrength)}>{STRENGTHS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
                {textField('estimated_volume_m3', 'Volumen estimado (m³)', 'number')}
                {draft.concrete_strength === 'other' && textField('concrete_strength_other', 'Descripción de resistencia *')}
                {textField('scheduled_date', 'Fundición / entrega prevista', 'date')}
                <Field id="work-pump" label="Necesita bomba"><select id="work-pump" className={selectClass} value={draft.needs_pump} onChange={e => change('needs_pump', e.target.value as UnknownBoolean)}>{TRI_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
                <Field id="work-mixer" label="Acceso para mixer"><select id="work-mixer" className={selectClass} value={draft.mixer_access} onChange={e => change('mixer_access', e.target.value as UnknownBoolean)}>{TRI_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
              </div>
              <p className="text-xs text-muted-foreground">Registra la resistencia indicada. El sistema no determina requisitos estructurales ni precios.</p>
            </TabsContent>
            <TabsContent value="sale" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="work-stage" label="Etapa *"><select id="work-stage" className={selectClass} value={draft.stage_id} onChange={e => change('stage_id', e.target.value)}>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
                <Field id="work-assignee" label="Asesor"><select id="work-assignee" className={selectClass} value={draft.assigned_to} onChange={e => change('assigned_to', e.target.value)}><option value="">Sin asignar</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></Field>
                {textField('value', 'Valor estimado', 'number')}
                <Field id="work-currency" label="Moneda"><select id="work-currency" className={selectClass} value={draft.currency} onChange={e => change('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select></Field>
                {textField('expected_close_date', 'Cierre comercial previsto', 'date')}
              </div>
              {losing && <div className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold">No concretado · motivo obligatorio</p>
                <Field id="work-reason" label="Motivo de no concretado *"><select id="work-reason" className={selectClass} value={draft.loss_reason_id} onChange={e => change('loss_reason_id', e.target.value)}><option value="">Seleccionar motivo</option>{reasons.filter(r => r.is_active || r.id === deal?.loss_reason_id).map(r => <option key={r.id} value={r.id}>{r.name}{!r.is_active ? ' (inactivo)' : ''}</option>)}</select></Field>
                <Field id="work-reason-detail" label={reasons.find(r => r.id === draft.loss_reason_id)?.requires_detail ? 'Explicación del motivo *' : 'Detalle del motivo (opcional)'}><Textarea id="work-reason-detail" value={draft.loss_reason_detail} onChange={e => change('loss_reason_detail', e.target.value)} className="bg-muted" /></Field>
                <p className="text-xs text-muted-foreground">La etapa anterior se conserva si cancelas sin guardar.</p>
              </div>}
              <Field id="work-notes" label="Notas"><Textarea id="work-notes" value={draft.notes} onChange={e => change('notes', e.target.value)} className="min-h-24 bg-muted" /></Field>
              {deal && <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={saving} onClick={() => handleStatus('won')}>Ganado</Button>
                <Button variant="outline" disabled={saving} onClick={() => handleStatus('lost')}>{commercial ? 'No concretado' : t('markAsLost')}</Button>
                {deal.status !== 'open' && <Button variant="ghost" disabled={saving} onClick={() => handleStatus('open')}>Reabrir</Button>}
                {commercial && <p className="w-full text-xs text-muted-foreground">Confirma el cambio con Guardar cambios.</p>}
              </div>}
            </TabsContent>
          </div>
        </Tabs>
        <div className="shrink-0 space-y-3 border-t border-border/50 bg-popover p-4">
          <div className="flex gap-2"><Button variant="outline" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="flex-1" disabled={saving} onClick={handleSave}>{saving ? 'Guardando…' : deal ? 'Guardar cambios' : 'Crear oportunidad'}</Button></div>
          {deal && (confirmDelete ? <div className="flex flex-wrap items-center gap-2 text-xs"><span>¿Eliminar esta oportunidad?</span><Button size="sm" variant="outline" disabled={saving} onClick={() => setConfirmDelete(false)}>Cancelar eliminación</Button><Button size="sm" variant="destructive" disabled={saving} onClick={handleDelete}>Confirmar eliminación</Button></div> : <Button size="sm" variant="ghost" disabled={saving} className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Eliminar oportunidad</Button>)}
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
