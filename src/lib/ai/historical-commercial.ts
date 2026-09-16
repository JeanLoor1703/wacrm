import type { Contact, ConcreteStrength } from '@/types';

export interface HistoricalMessage {
  sent_at: string;
  sender: 'customer' | 'agent' | 'bot';
  text: string;
}

export interface HistoricalWorkSuggestion {
  title: string | null;
  location: string | null;
  estimated_volume_m3: number | null;
  concrete_strength: ConcreteStrength | null;
  quote_requested: boolean;
}

export interface HistoricalCommercialProposal {
  probable_name: string | null;
  probable_company: string | null;
  mentioned_locations: string[];
  possible_works: HistoricalWorkSuggestion[];
  commercial_intent: 'unknown' | 'low' | 'medium' | 'high';
  probable_status:
    'unknown' | 'open' | 'not_converted' | 'possible_historical_sale';
  possible_purchase: boolean;
  follow_up_needed: boolean;
  evidence: string[];
}

const emptyProposal = (): HistoricalCommercialProposal => ({
  probable_name: null,
  probable_company: null,
  mentioned_locations: [],
  possible_works: [],
  commercial_intent: 'unknown',
  probable_status: 'unknown',
  possible_purchase: false,
  follow_up_needed: false,
  evidence: [],
});

export function historicalAnalysisPrompt(
  contact: Pick<Contact, 'name' | 'company'>,
  messages: HistoricalMessage[]
): string {
  return [
    'Analiza historial comercial de CREACOM en modo SOLO ANALISIS.',
    'No escribas respuestas al cliente, no invoques herramientas y no marques ventas confirmadas.',
    'Devuelve JSON. Usa null/unknown cuando no exista evidencia explícita.',
    'Una posible compra debe usar probable_status=possible_historical_sale; la confirmación oficial es humana o de una fuente confiable.',
    'Incluye fragmentos breves de evidencia, nunca razonamiento interno ni secretos.',
    `Contacto actual: ${JSON.stringify(contact)}`,
    `Mensajes ordenados: ${JSON.stringify(messages)}`,
  ].join('\n');
}

export function parseHistoricalProposal(
  raw: string
): HistoricalCommercialProposal {
  let value: unknown;
  try {
    value = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
    );
  } catch {
    return emptyProposal();
  }
  if (!value || typeof value !== 'object') return emptyProposal();
  const source = value as Record<string, unknown>;
  const stringOrNull = (key: string) =>
    typeof source[key] === 'string' && String(source[key]).trim()
      ? String(source[key]).trim()
      : null;
  const list = (key: string) =>
    Array.isArray(source[key])
      ? (source[key] as unknown[])
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];
  const possible_works = Array.isArray(source.possible_works)
    ? source.possible_works.slice(0, 20).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const work = item as Record<string, unknown>;
        const volume =
          typeof work.estimated_volume_m3 === 'number' &&
          Number.isFinite(work.estimated_volume_m3) &&
          work.estimated_volume_m3 > 0
            ? work.estimated_volume_m3
            : null;
        const strength =
          typeof work.concrete_strength === 'string' &&
          ['H-180', 'H-210', 'H-240', 'H-280', 'other', 'unknown'].includes(
            work.concrete_strength
          )
            ? (work.concrete_strength as ConcreteStrength)
            : null;
        return [
          {
            title:
              typeof work.title === 'string' && work.title.trim()
                ? work.title.trim()
                : null,
            location:
              typeof work.location === 'string' && work.location.trim()
                ? work.location.trim()
                : null,
            estimated_volume_m3: volume,
            concrete_strength: strength,
            quote_requested: work.quote_requested === true,
          },
        ];
      })
    : [];
  const intent =
    typeof source.commercial_intent === 'string' &&
    ['low', 'medium', 'high'].includes(source.commercial_intent)
      ? (source.commercial_intent as 'low' | 'medium' | 'high')
      : 'unknown';
  const status =
    typeof source.probable_status === 'string' &&
    ['open', 'not_converted', 'possible_historical_sale'].includes(
      source.probable_status
    )
      ? (source.probable_status as
          'open' | 'not_converted' | 'possible_historical_sale')
      : 'unknown';
  return {
    probable_name: stringOrNull('probable_name'),
    probable_company: stringOrNull('probable_company'),
    mentioned_locations: list('mentioned_locations'),
    possible_works,
    commercial_intent: intent,
    probable_status: status,
    possible_purchase: source.possible_purchase === true,
    follow_up_needed: source.follow_up_needed === true,
    evidence: list('evidence'),
  };
}

/** Analysis-only boundary: accepts history and an injected model, never a sender. */
export async function analyzeHistoricalConversation(
  contact: Pick<Contact, 'name' | 'company'>,
  messages: HistoricalMessage[],
  analyze: (prompt: string) => Promise<string>
): Promise<HistoricalCommercialProposal> {
  const ordered = [...messages].sort((a, b) =>
    a.sent_at.localeCompare(b.sent_at)
  );
  return parseHistoricalProposal(
    await analyze(historicalAnalysisPrompt(contact, ordered))
  );
}
