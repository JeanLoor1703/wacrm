import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { retrieveKnowledge } from '@/lib/ai/knowledge'
import { generateReply } from '@/lib/ai/generate'
import { latestUserMessage } from '@/lib/ai/query'
import { AiError, type ChatMessage } from '@/lib/ai/types'
import { commercialSystemPrompt, mergeCommercialUpdates, parseCommercialResult } from '@/lib/ai/commercial'

const MAX_TURNS = 20
const HUMAN_REQUEST = /\b(vendedor|persona|humano|asesor|negociar|negociación|precio|descuento|crédito|reclamo|queja)\b/i

/** Internal-only commercial simulator. It never sends WhatsApp/Meta traffic. */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')
    const limit = checkRateLimit(`ai-simulator:${userId}`, RATE_LIMITS.aiDraft)
    if (!limit.success) return rateLimitResponse(limit)
    const body = await request.json().catch(() => null)
    const dealId = typeof body?.deal_id === 'string' ? body.deal_id : ''
    if (!dealId) return NextResponse.json({ error: 'deal_id is required' }, { status: 400 })
    const rawMessages = Array.isArray(body?.messages) ? body.messages : []
    const messages: ChatMessage[] = rawMessages.filter((m: unknown): m is ChatMessage => !!m && typeof m === 'object' && ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') && typeof (m as ChatMessage).content === 'string' && (m as ChatMessage).content.trim().length > 0).slice(-MAX_TURNS)
    if (!messages.length) return NextResponse.json({ error: 'Send a message to test the assistant.' }, { status: 400 })

    const { data: deal, error: dealError } = await supabase.from('deals').select('*').eq('id', dealId).eq('account_id', accountId).maybeSingle()
    if (dealError || !deal) return NextResponse.json({ error: 'Opportunity not found in this account.' }, { status: 404 })
    const config = await loadAiConfig(supabase, accountId, { requireActive: false })
    if (!config) return NextResponse.json({ error: 'No AI provider configured.', code: 'ai_not_configured' }, { status: 400 })

    const knowledge = await retrieveKnowledge(supabase, accountId, config, latestUserMessage(messages))
    const systemPrompt = commercialSystemPrompt(config.systemPrompt, deal)
    const generated = await generateReply({ config, systemPrompt: `${systemPrompt}\n\n${knowledge.length ? `Knowledge base:\n${knowledge.join('\n---\n')}` : ''}`, messages })
    const parsed = parseCommercialResult(generated.text)
    const { applied, conflicts } = mergeCommercialUpdates(deal, parsed.updates)
    const explicitHuman = HUMAN_REQUEST.test(latestUserMessage(messages)) || parsed.updates.handoff === true || generated.handoff

    const auditRows: Record<string, unknown>[] = []
    const write = async (table: string, payload: Record<string, unknown>, id: string) => {
      const result = await supabase.from(table).update(payload).eq('id', id).eq('account_id', accountId).select('id').maybeSingle()
      if (result.error) throw result.error
    }
    const dealPatch: Record<string, unknown> = { ...applied }
    delete dealPatch.title // set below only through allowlisted applied value
    if (applied.title !== undefined) dealPatch.title = applied.title
    if (Object.keys(dealPatch).length) {
      await write('deals', dealPatch, dealId)
      for (const [field, value] of Object.entries(dealPatch)) auditRows.push({ account_id: accountId, deal_id: dealId, field_name: field, old_value: deal[field] ?? null, new_value: value, origin: 'ai', actor_user_id: userId, metadata: { surface: 'commercial_simulator' } })
    }
    if (typeof parsed.updates.contact_name === 'string' && deal.contact_id) {
      const { data: contact } = await supabase.from('contacts').select('id, name').eq('id', deal.contact_id).eq('account_id', accountId).maybeSingle()
      if (contact) {
        if (!contact.name?.trim()) {
          await supabase.from('contacts').update({ name: parsed.updates.contact_name }).eq('id', contact.id).eq('account_id', accountId)
          auditRows.push({ account_id: accountId, deal_id: dealId, field_name: 'contact.name', old_value: contact.name ?? null, new_value: parsed.updates.contact_name, origin: 'ai', actor_user_id: userId, metadata: { surface: 'commercial_simulator' } })
        } else if (contact.name !== parsed.updates.contact_name) conflicts.push('contact_name')
      }
    }

    let stageKey: string | null = null
    const { data: stage } = await supabase.from('pipeline_stages').select('id, semantic_key').eq('pipeline_id', deal.pipeline_id).eq('id', deal.stage_id).maybeSingle()
    stageKey = stage?.semantic_key ?? null
    const hasQualification = ['work_type', 'work_location', 'estimated_volume_m3'].some((key) => applied[key] !== undefined)
    if (!explicitHuman && stageKey === 'new' && hasQualification) {
      const { data: target } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', deal.pipeline_id).eq('semantic_key', 'qualifying').maybeSingle()
      if (target?.id) {
        await write('deals', { stage_id: target.id, status: 'open' }, dealId)
        auditRows.push({ account_id: accountId, deal_id: dealId, field_name: 'stage_id', old_value: deal.stage_id, new_value: target.id, origin: 'ai', actor_user_id: userId, metadata: { semantic_key: 'qualifying', surface: 'commercial_simulator' } })
        stageKey = 'qualifying'
      }
    }

    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : null
    if (conversationId) {
      const { data: conversation } = await supabase.from('conversations').select('id, ai_handoff_state, ai_autoreply_disabled').eq('id', conversationId).eq('account_id', accountId).eq('contact_id', deal.contact_id).maybeSingle()
      if (conversation && explicitHuman) {
        await supabase.from('conversations').update({ ai_handoff_state: 'HUMAN_REQUESTED', ai_autoreply_disabled: true, ai_handoff_reason: parsed.updates.handoff_reason || 'Solicitud de asesor o asunto comercial', ai_handoff_requested_at: new Date().toISOString(), ai_handoff_summary: 'La IA solicitó intervención humana desde el simulador.' }).eq('id', conversationId).eq('account_id', accountId)
      }
    }
    if (auditRows.length) await supabase.from('ai_change_log').insert(auditRows)
    return NextResponse.json({ reply: parsed.reply || (explicitHuman ? 'Te comunico con un asesor para revisar este caso.' : 'Gracias. ¿Qué otro dato de la obra deseas confirmar?'), updates: applied, conflicts, handoff: explicitHuman, stage_key: stageKey })
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    return toErrorResponse(err)
  }
}
