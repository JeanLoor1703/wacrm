import type { ProviderResult } from '../types'
import { generateOpenAi } from './openai'
import type { ProviderArgs } from './shared'

/** Groq exposes an OpenAI-compatible Chat Completions API. */
export function generateGroq(args: ProviderArgs): Promise<ProviderResult> {
  return generateOpenAi({
    ...args,
    baseUrl: args.baseUrl || 'https://api.groq.com/openai/v1',
  })
}
