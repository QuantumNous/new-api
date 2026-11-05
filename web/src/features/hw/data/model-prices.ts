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
 * Price table of the HisarWeb AI channel-1 models, measured on 2026-10-27.
 * HisarWeb bills every model at half the official list price
 * (`HwListPriceDiscountPercent` in `service/hw_pricing.go`).
 *
 * Every amount is USD per 1 million tokens, copied from the verified
 * measurement: the providers' own pricing pages, the OpenRouter models list
 * and HisarWeb's `/api/pricing`. A source that does not list a model (xAI
 * delisted grok-4 and grok-4-fast; OpenRouter does not carry the grok
 * names) is `null`, and the table then shows a dash instead of a guess.
 * Lira amounts are computed from `MODEL_PRICES_TRY_PER_USD`, nothing here is
 * stored in lira.
 */

export type PriceProvider = 'Anthropic' | 'OpenAI' | 'Google' | 'xAI'

export type PriceSourceId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'hisarweb'

/** USD per 1 million tokens. */
export type TokenPrice = {
  input: number
  output: number
}

export type ModelPrice = {
  model: string
  provider: PriceProvider
  official: TokenPrice | null
  openrouter: TokenPrice | null
  hisarweb: TokenPrice | null
}

export type PriceSource = {
  id: PriceSourceId
  name: string
  url: string
  measuredAt: string
}

export const MODEL_PRICES_MEASURED_AT = '2026-10-27'

/** TRY per 1 USD (TCMB, without KDV): `custom_currency_exchange_rate`. */
export const MODEL_PRICES_TRY_PER_USD = 49.7627
export const MODEL_PRICES_FX_DATE = '2026-10-27'

export const PRICE_SOURCES: readonly PriceSource[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://platform.claude.com/docs/en/about-claude/pricing',
    measuredAt: MODEL_PRICES_MEASURED_AT,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://developers.openai.com/api/docs/pricing',
    measuredAt: MODEL_PRICES_MEASURED_AT,
  },
  {
    id: 'google',
    name: 'Google',
    url: 'https://ai.google.dev/gemini-api/docs/pricing',
    measuredAt: MODEL_PRICES_MEASURED_AT,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/models',
    measuredAt: MODEL_PRICES_MEASURED_AT,
  },
  {
    id: 'hisarweb',
    name: 'HisarWeb AI',
    url: 'https://api.hisarweb.be/api/pricing',
    measuredAt: MODEL_PRICES_MEASURED_AT,
  },
]

/**
 * Official API pricing page of each provider, verified live on 2026-11-04
 * (HTTP 200, the page names the model family with its price). Every model of
 * `MODEL_PRICES` gets its link from its provider, so a new model of a known
 * provider needs no new link, and a new provider does not compile without one.
 */
export const OFFICIAL_PRICING_URL: Readonly<Record<PriceProvider, string>> = {
  Anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  OpenAI: 'https://developers.openai.com/api/docs/pricing',
  Google: 'https://ai.google.dev/gemini-api/docs/pricing',
  xAI: 'https://docs.x.ai/docs/models',
}

/** Same order as the catalogue ("Recommended"): see `RECOMMENDED_ORDER` in `model-guide.ts`. */
export const MODEL_PRICES: readonly ModelPrice[] = [
  {
    model: 'gpt-6-astra',
    provider: 'OpenAI',
    official: { input: 10, output: 50 },
    openrouter: { input: 10, output: 50 },
    hisarweb: { input: 5, output: 25 },
  },
  {
    model: 'gpt-6.1-sol',
    provider: 'OpenAI',
    official: { input: 2, output: 10 },
    openrouter: { input: 2, output: 10 },
    hisarweb: { input: 1, output: 5 },
  },
  {
    model: 'gpt-6-luna',
    provider: 'OpenAI',
    official: { input: 0.1, output: 0.5 },
    openrouter: { input: 0.1, output: 0.5 },
    hisarweb: { input: 0.05, output: 0.25 },
  },
  {
    // xAI delisted both grok names from its own pricing pages; no official
    // list price exists, so the columns show a dash instead of a guess.
    model: 'grok-4',
    provider: 'xAI',
    official: null,
    openrouter: null,
    hisarweb: { input: 1, output: 3 },
  },
  {
    model: 'grok-4-fast',
    provider: 'xAI',
    official: null,
    openrouter: null,
    hisarweb: { input: 1, output: 3 },
  },
]

/** Price of 1M input tokens plus 1M output tokens. */
export function blendedPrice(price: TokenPrice): number {
  return price.input + price.output
}

/**
 * Saving of `ours` against `reference` as a fraction (0.25 is 25% cheaper). It
 * is negative when `ours` is more expensive, and `null` when either side is
 * missing or the reference is free, so nothing is guessed.
 */
export function savingFraction(
  reference: TokenPrice | null,
  ours: TokenPrice | null
): number | null {
  if (!reference || !ours) return null
  const base = blendedPrice(reference)
  if (base <= 0) return null
  return (base - blendedPrice(ours)) / base
}

/**
 * Official input price (USD per 1M tokens) from which a model counts as
 * premium: it uses up credit much faster, so the console warns about it and
 * points to the cheaper model one step lower. Matches the backend threshold.
 */
export const PREMIUM_INPUT_USD_PER_M = 10

/** The sold model's price entry, or undefined for a model we do not sell. */
export function priceOf(
  model: string | undefined,
  models: readonly ModelPrice[]
): ModelPrice | undefined {
  if (!model) return undefined
  return models.find((entry) => entry.model === model)
}

/** True when the official input price is at or above the premium threshold. */
export function isPremiumModel(
  model: string | undefined,
  models: readonly ModelPrice[] = MODEL_PRICES
): boolean {
  const input = priceOf(model, models)?.official?.input
  return input !== undefined && input >= PREMIUM_INPUT_USD_PER_M
}

/**
 * The model one step lower for a premium model: the model of the same
 * provider with the highest official input price strictly below it. Undefined
 * for a model that is not premium or has no cheaper sibling.
 */
export function premiumStepDown(
  model: string | undefined,
  models: readonly ModelPrice[] = MODEL_PRICES
): string | undefined {
  const premium = priceOf(model, models)
  const input = premium?.official?.input
  if (!premium || input === undefined || input < PREMIUM_INPUT_USD_PER_M) {
    return undefined
  }
  let best: ModelPrice | undefined
  for (const entry of models) {
    const candidate = entry.official?.input
    if (entry.provider !== premium.provider || candidate === undefined) continue
    if (candidate >= input) continue
    if (!best || candidate > (best.official?.input ?? -1)) best = entry
  }
  return best?.model
}
