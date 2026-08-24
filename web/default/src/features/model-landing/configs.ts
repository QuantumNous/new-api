/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * Per-model landing page data. Marketing copy lives in i18n (model-page.tsx via
 * t()); this file holds only the model-specific *data* (ids, numbers, code,
 * example prompt) that does not get translated.
 *
 * Pricing numbers are illustrative placeholders for the keyword-matched landing
 * page — the authoritative prices live on the /pricing page. Keep them honest
 * (real official list price vs. flatkey's discounted price) and update when the
 * pricing page changes.
 */

export interface ModelPriceRow {
  /** Natural-English i18n key for the row label, e.g. 'Opus 4 output'.
   *  (i18next keySeparator defaults to '.', so keys must avoid dots → we use
   *  plain English source strings, matching the flat locale-file convention.) */
  label: string
  /** flatkey price, display string e.g. "$7.5" */
  flatkey: string
  /** official price struck through, e.g. "$15"; omit for non-price rows */
  official?: string
  /** free-form value (used when there's no official strike, e.g. coverage) */
  value?: string
}

export interface ModelConfig {
  /** URL slug / route, e.g. 'claude-api' */
  slug: string
  /** Human model family name shown in copy, e.g. 'Claude Opus 4' */
  displayName: string
  /** model id used in code + playground, e.g. 'claude-opus-4' */
  modelId: string
  /** Official provider name, e.g. 'Anthropic' */
  officialName: string
  /** Headline output price comparison */
  officialPrice: string
  flatkeyPrice: string
  priceUnitKey: string // i18n key suffix for the unit, e.g. 'per_m_output'
  /** Rough single-call cost estimate strings */
  estFlatkey: string
  estOfficial: string
  /** Example prompt prefilled in the playground (kept in English; developers
   *  read it fine and translating prompts adds little value). */
  examplePrompt: string
  /** Pricing table rows */
  rows: ModelPriceRow[]
}

const COVERAGE = 'GPT · Gemini · Claude · DeepSeek · Seedance'

export const CLAUDE_CONFIG: ModelConfig = {
  slug: 'claude-api',
  displayName: 'Claude Opus 4',
  modelId: 'claude-opus-4',
  officialName: 'Anthropic',
  officialPrice: '$15.00',
  flatkeyPrice: '$10.00',
  priceUnitKey: 'per_m_output',
  estFlatkey: '$0.005',
  estOfficial: '$0.008',
  examplePrompt:
    'You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.',
  rows: [
    { label: 'Opus 4 output', flatkey: '$10.0', official: '$15' },
    { label: 'Sonnet 4 output', flatkey: '$10.0', official: '$15' },
    { label: 'Haiku output', flatkey: '$2.7', official: '$4' },
    { label: 'Cache reads', flatkey: '', value: '50% off' },
    { label: 'Coverage', flatkey: '', value: COVERAGE },
  ],
}

export const GPT_CONFIG: ModelConfig = {
  slug: 'gpt-api',
  displayName: 'GPT-5',
  modelId: 'gpt-5',
  officialName: 'OpenAI',
  officialPrice: '$10.00',
  flatkeyPrice: '$6.67',
  priceUnitKey: 'per_m_output',
  estFlatkey: '$0.004',
  estOfficial: '$0.006',
  examplePrompt:
    'You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.',
  rows: [
    { label: 'GPT-5 output', flatkey: '$6.7', official: '$10' },
    { label: 'GPT-5 mini output', flatkey: '$1.3', official: '$2' },
    { label: 'GPT-5 input', flatkey: '$0.83', official: '$1.25' },
    { label: 'Cache reads', flatkey: '', value: '50% off' },
    { label: 'Coverage', flatkey: '', value: COVERAGE },
  ],
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [CLAUDE_CONFIG.slug]: CLAUDE_CONFIG,
  [GPT_CONFIG.slug]: GPT_CONFIG,
}
