'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, Send, UserCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DealOption { id: string; title: string; contact_id: string | null; work_location?: string | null; estimated_volume_m3?: number | null; }
interface ContactOption { id: string; name?: string; phone: string; }
interface Turn { role: 'user' | 'assistant'; content: string; handoff?: boolean; updates?: Record<string, unknown>; }

// Intent: asesor prueba la calificación de una obra en pocos pasos; focal = conversación + siguiente pregunta.
// Palette: superficies blancas, gris concreto y rojo CREACOM sólo para acciones. Profundidad: bordes suaves.
export function AiCommercialSimulator() {
  const db = useMemo(() => createClient(), []);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [dealId, setDealId] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: dealRows }, { data: contactRows }] = await Promise.all([
      db.from('deals').select('id,title,contact_id,work_location,estimated_volume_m3').order('updated_at', { ascending: false }).limit(50),
      db.from('contacts').select('id,name,phone').order('name').limit(100),
    ]);
    setDeals((dealRows ?? []) as DealOption[]); setContacts((contactRows ?? []) as ContactOption[]);
    if (!dealId && dealRows?.[0]?.id) setDealId(dealRows[0].id);
  }, [db, dealId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, sending]);

  const send = async () => {
    const text = input.trim(); if (!text || !dealId || sending) return;
    const next = [...turns, { role: 'user' as const, content: text }]; setTurns(next); setInput(''); setSending(true);
    const deal = deals.find((item) => item.id === dealId);
    try {
      const conversation = deal?.contact_id ? (await db.from('conversations').select('id').eq('contact_id', deal.contact_id).limit(1).maybeSingle()).data : null;
      const res = await fetch('/api/ai/simulator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: dealId, conversation_id: conversation?.id, messages: next.map(({ role, content }) => ({ role, content })) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo consultar la IA.');
      setTurns([...next, { role: 'assistant', content: data.reply, handoff: Boolean(data.handoff), updates: data.updates }]);
      if (data.updates && Object.keys(data.updates).length) { toast.success('IA actualizó sólo datos explícitos de la obra.'); await load(); }
    } catch (error) { setTurns(turns); setInput(text); toast.error(error instanceof Error ? error.message : 'No se pudo consultar la IA.'); } finally { setSending(false); }
  };
  const contactLabel = (id: string | null) => { const c = contacts.find((item) => item.id === id); return c ? `${c.name || 'Sin nombre'} · ${c.phone}` : 'Cliente sin contacto'; };
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="flex min-h-[520px] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Simulador comercial CREACOM</span></div><Button variant="ghost" size="sm" onClick={() => setTurns([])} disabled={!turns.length}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Limpiar</Button></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{!turns.length && <p className="py-20 text-center text-sm text-muted-foreground">Escribe como cliente. La IA pregunta sólo lo que falta y registra datos explícitos.</p>}{turns.map((turn, index) => <div key={index} className={cn('flex gap-2', turn.role === 'user' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-2xl px-3.5 py-2 text-sm', turn.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground')}><p className="whitespace-pre-wrap">{turn.content}</p>{turn.updates && Object.keys(turn.updates).length > 0 && <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">IA actualizó: {Object.keys(turn.updates).join(', ')}</p>}{turn.handoff && <p className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2 text-xs text-amber-600"><UserCircle2 className="h-3.5 w-3.5" />Intervención humana solicitada</p>}</div></div>)}{sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-5 w-5 text-primary" /><Loader2 className="h-4 w-4 animate-spin" />Analizando datos explícitos…</div>}<div ref={endRef} /></div>
      <div className="flex items-end gap-2 border-t border-border p-3"><Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void send(); } }} placeholder="Ej. Necesito 22 m³ para una losa en Quevedo" disabled={!dealId || sending} /><Button onClick={() => void send()} disabled={!dealId || !input.trim() || sending} size="sm" className="h-10 w-10 shrink-0 p-0">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
    </div>
    <aside className="rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Contexto de prueba</h2><p className="mt-1 text-xs text-muted-foreground">Sólo datos de tu cuenta. No envía mensajes externos.</p><label className="mt-4 block text-xs font-medium" htmlFor="sim-deal">Obra / oportunidad</label><select id="sim-deal" value={dealId} onChange={(e) => { setDealId(e.target.value); setTurns([]); }} className="mt-2 h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm" >{deals.length === 0 && <option value="">No hay oportunidades CREACOM</option>}{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title} · {contactLabel(deal.contact_id)}</option>)}</select><p className="mt-4 text-xs text-muted-foreground">Puedes crear o editar obras desde Ventas CREACOM y volver aquí para probar la calificación progresiva.</p></aside>
  </div>;
}
