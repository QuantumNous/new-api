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
import {
  isDynamicPricingModel,
  hasTaskUsageSchema,
} from '@/features/pricing/lib/dynamic-price'
import { getDisplayGroupRatio } from '@/features/pricing/lib/model-helpers'
import type { PricingModel } from '@/features/pricing/types'
import {
  OFFICIAL_PRICE_USD_TO_CNY,
  resolveModelProvider,
} from '@/features/usage-logs/lib/model-provider'

export type ModelFamily =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'moonshot'
  | 'qwen'
  | 'other'

export type SavingsUseCase = 'coding' | 'agents' | 'support' | 'research'

export type SavingsModel = {
  modelName: string
  vendorName: string
  vendorIcon?: string
  endpointTypes?: string[]
  family: ModelFamily
  baseInputPrice: number
  baseOutputPrice: number
  baseCacheReadPrice: number | null
  baseCacheWritePrice: number | null
  siteInputPrice: number
  siteOutputPrice: number
  siteCacheReadPrice: number | null
  siteCacheWritePrice: number | null
  savingsPercent: number
}

export type SavingsTokenMix = {
  inputPercent: number
  cacheReadPercent: number
  cacheWritePercent: number
  outputPercent: number
}

export type SavingsEstimate = {
  representativeModels: SavingsModel[]
  tokenMix: SavingsTokenMix
  baseMonthlyCost: number
  siteMonthlyCost: number
  monthlySavings: number
  annualSavings: number
}

export const TOKEN_SLIDER_MIN_MILLIONS = 1
export const TOKEN_SLIDER_MAX_MILLIONS = 200
export const TOKEN_SLIDER_STEPS = 100
export const DEFAULT_MONTHLY_TOKENS_MILLIONS = 20

const MAX_COMPARISON_MODELS = 6

const ECONOMY_MODEL_PATTERN =
  /(?:^|[-_./ ])(?:flash|haiku|instant|lite|mini|nano|small|tiny)(?:$|[-_./ ])/i
const FLAGSHIP_MODEL_PATTERN =
  /(?:^|[-_./ ])(?:max|opus|pro|ultra)(?:$|[-_./ ])/i

const FAMILY_ORDER: ModelFamily[] = [
  'openai',
  'anthropic',
  'deepseek',
  'moonshot',
  'google',
  'qwen',
]

const USE_CASES: Record<
  SavingsUseCase,
  { families: ModelFamily[]; tokenMix: SavingsTokenMix }
> = {
  // These are editable scenario presets, not claims about every workload.
  coding: {
    families: ['anthropic', 'openai', 'qwen'],
    tokenMix: {
      inputPercent: 15,
      cacheReadPercent: 55,
      cacheWritePercent: 10,
      outputPercent: 20,
    },
  },
  agents: {
    families: ['openai', 'anthropic', 'google'],
    tokenMix: {
      inputPercent: 25,
      cacheReadPercent: 40,
      cacheWritePercent: 10,
      outputPercent: 25,
    },
  },
  support: {
    families: ['deepseek', 'moonshot', 'qwen'],
    tokenMix: {
      inputPercent: 50,
      cacheReadPercent: 15,
      cacheWritePercent: 5,
      outputPercent: 30,
    },
  },
  research: {
    families: ['google', 'qwen', 'moonshot'],
    tokenMix: {
      inputPercent: 45,
      cacheReadPercent: 20,
      cacheWritePercent: 5,
      outputPercent: 30,
    },
  },
}

export function getDefaultSavingsTokenMix(
  useCase: SavingsUseCase
): SavingsTokenMix {
  return { ...USE_CASES[useCase].tokenMix }
}

export function getBillableSavingsTokenMix(
  tokenMix: SavingsTokenMix,
  model?: SavingsModel
): SavingsTokenMix {
  const normalizedMix = normalizeTokenMix(tokenMix)
  if (!model) return normalizedMix

  const cacheReadPercent =
    model.siteCacheReadPrice == null ? 0 : normalizedMix.cacheReadPercent
  const cacheWritePercent =
    model.siteCacheWritePrice == null ? 0 : normalizedMix.cacheWritePercent

  return {
    inputPercent:
      normalizedMix.inputPercent +
      (normalizedMix.cacheReadPercent - cacheReadPercent) +
      (normalizedMix.cacheWritePercent - cacheWritePercent),
    cacheReadPercent,
    cacheWritePercent,
    outputPercent: normalizedMix.outputPercent,
  }
}

function normalizeTokenMix(tokenMix: SavingsTokenMix): SavingsTokenMix {
  const parts = [
    tokenMix.inputPercent,
    tokenMix.cacheReadPercent,
    tokenMix.cacheWritePercent,
    tokenMix.outputPercent,
  ].map((value) =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  )
  const total = parts.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return {
      inputPercent: 100,
      cacheReadPercent: 0,
      cacheWritePercent: 0,
      outputPercent: 0,
    }
  }

  const scale = 100 / total
  return {
    inputPercent: parts[0] * scale,
    cacheReadPercent: parts[1] * scale,
    cacheWritePercent: parts[2] * scale,
    outputPercent: parts[3] * scale,
  }
}

function getModelFamily(model: PricingModel): ModelFamily {
  const haystack =
    `${model.vendor_name ?? ''} ${model.model_name}`.toLowerCase()

  if (/\b(openai|gpt[-_/ ]|chatgpt|o\d+(?:[-_/ ]|$))/i.test(haystack)) {
    return 'openai'
  }
  if (/\b(anthropic|claude[-_/ ])/i.test(haystack)) {
    return 'anthropic'
  }
  if (/\b(google|gemini[-_/ ])/i.test(haystack)) {
    return 'google'
  }
  if (/\bdeepseek/i.test(haystack)) {
    return 'deepseek'
  }
  if (/\b(moonshot|kimi[-_/ ])/i.test(haystack)) {
    return 'moonshot'
  }
  if (/\b(qwen|tongyi|alibaba)/i.test(haystack)) {
    return 'qwen'
  }
  return 'other'
}

function getFallbackVendorName(family: ModelFamily): string {
  switch (family) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'google':
      return 'Google'
    case 'deepseek':
      return 'DeepSeek'
    case 'moonshot':
      return 'Moonshot'
    case 'qwen':
      return 'Qwen'
    case 'other':
      return 'AI'
  }
}

function getVendorKey(model: PricingModel): string {
  if (model.vendor_id) return `id:${model.vendor_id}`
  if (model.vendor_name?.trim()) {
    return `name:${model.vendor_name.trim().toLowerCase()}`
  }
  return `family:${getModelFamily(model)}`
}

function getModelVersion(model: PricingModel): number[] {
  const name = model.model_name.toLowerCase()
  const family = getModelFamily(model)
  const familyPattern: Record<ModelFamily, RegExp> = {
    openai: /(?:gpt|chatgpt|^o)[-_/ ]*v?(\d+)(?:[._-](\d+))?/i,
    anthropic: /claude.*?v?(\d+)(?:[._-](\d+))?/i,
    google: /gemini.*?v?(\d+)(?:[._-](\d+))?/i,
    deepseek: /deepseek.*?v?(\d+)(?:[._-](\d+))?/i,
    moonshot: /(?:moonshot|kimi).*?[vk]?(\d+)(?:[._-](\d+))?/i,
    qwen: /qwen.*?v?(\d+)(?:[._-](\d+))?/i,
    other: /(?:^|[-_/ ])v?(\d+)(?:[._-](\d+))?/i,
  }
  const match = name.match(familyPattern[family])
  if (!match) return []

  const major = Number(match[1])
  const minor = match[2] && match[2].length <= 2 ? Number(match[2]) : 0
  return [major, minor]
}

function compareVersion(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function compareLatestModel(left: PricingModel, right: PricingModel): number {
  const versionDifference = compareVersion(
    getModelVersion(left),
    getModelVersion(right)
  )
  if (versionDifference !== 0) return versionDifference

  const leftEconomy = ECONOMY_MODEL_PATTERN.test(left.model_name) ? 1 : 0
  const rightEconomy = ECONOMY_MODEL_PATTERN.test(right.model_name) ? 1 : 0
  if (leftEconomy !== rightEconomy) return leftEconomy - rightEconomy

  const leftFlagship = FLAGSHIP_MODEL_PATTERN.test(left.model_name) ? 1 : 0
  const rightFlagship = FLAGSHIP_MODEL_PATTERN.test(right.model_name) ? 1 : 0
  if (leftFlagship !== rightFlagship) return rightFlagship - leftFlagship

  const ratioDifference = right.model_ratio - left.model_ratio
  if (ratioDifference !== 0) return ratioDifference

  return right.model_name.localeCompare(left.model_name, undefined, {
    numeric: true,
  })
}

function toSavingsModel(
  model: PricingModel,
  priceRate: number,
  groupRatio = getDisplayGroupRatio(model)
): SavingsModel | null {
  if (!Number.isFinite(groupRatio) || !Number.isFinite(priceRate)) return null
  const displayGroupRatio = Math.max(groupRatio, 0)
  const normalizedPriceRate = Math.max(priceRate, 0.001)
  let inputPrice = model.model_ratio * 2
  let outputPrice = inputPrice * model.completion_ratio
  let cacheReadPrice = getOptionalRatio(model.cache_ratio)
  let cacheWritePrice = getOptionalRatio(model.create_cache_ratio)

  if (isDynamicPricingModel(model)) {
    // Display summaries intentionally omit zero entries and may parse only
    // part of an expression. Estimates require the entire supported formula.
    if (hasTaskUsageSchema(model)) return null
    const number = String.raw`(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`
    const term = String.raw`(?:p|c|cr|cc)\s*\*\s*${number}`
    const formula = new RegExp(
      String.raw`^\s*(?:v1:\s*)?tier\s*\(\s*"(?:[^"\\]|\\.)*"\s*,\s*(${term}(?:\s*\+\s*${term})*)\s*\)\s*$`
    )
    const match = model.billing_expr?.match(formula)
    if (!match) return null

    const prices = new Map<string, number>()
    const terms = new RegExp(String.raw`(p|c|cr|cc)\s*\*\s*(${number})`, 'g')
    for (const entry of match[1].matchAll(terms)) {
      const price = (prices.get(entry[1]) ?? 0) + Number(entry[2])
      if (!Number.isFinite(price)) return null
      prices.set(entry[1], price)
    }
    inputPrice = prices.get('p') ?? 0
    outputPrice = prices.get('c') ?? 0
    cacheReadPrice = prices.get('cr') ?? null
    cacheWritePrice = prices.get('cc') ?? null
    if (inputPrice <= 0 && outputPrice <= 0) return null
  } else {
    cacheReadPrice = cacheReadPrice == null ? null : inputPrice * cacheReadPrice
    cacheWritePrice =
      cacheWritePrice == null ? null : inputPrice * cacheWritePrice
  }

  const referenceCurrency = resolveModelProvider(
    model.model_name,
    model.vendor_name
  )?.referenceCurrency
  let referencePriceRate = normalizedPriceRate
  if (referenceCurrency === 'USD') {
    referencePriceRate = OFFICIAL_PRICE_USD_TO_CNY
  } else if (referenceCurrency === 'CNY') {
    referencePriceRate = 1
  }
  const baseInputPrice = inputPrice * referencePriceRate
  const baseOutputPrice = outputPrice * referencePriceRate
  const siteInputPrice = inputPrice * displayGroupRatio * normalizedPriceRate
  const siteOutputPrice = outputPrice * displayGroupRatio * normalizedPriceRate
  const baseCacheReadPrice =
    cacheReadPrice == null ? null : cacheReadPrice * referencePriceRate
  const baseCacheWritePrice =
    cacheWritePrice == null ? null : cacheWritePrice * referencePriceRate
  const siteCacheReadPrice =
    cacheReadPrice == null
      ? null
      : cacheReadPrice * displayGroupRatio * normalizedPriceRate
  const siteCacheWritePrice =
    cacheWritePrice == null
      ? null
      : cacheWritePrice * displayGroupRatio * normalizedPriceRate
  if (
    ![
      baseInputPrice,
      baseOutputPrice,
      baseCacheReadPrice,
      baseCacheWritePrice,
      siteInputPrice,
      siteOutputPrice,
      siteCacheReadPrice,
      siteCacheWritePrice,
    ].every((price) => price == null || Number.isFinite(price))
  ) {
    return null
  }
  const baseReferencePrice =
    baseInputPrice > 0 ? baseInputPrice : baseOutputPrice
  const siteReferencePrice =
    baseInputPrice > 0 ? siteInputPrice : siteOutputPrice
  const rawSavingsPercent =
    baseReferencePrice > 0
      ? (1 - siteReferencePrice / baseReferencePrice) * 100
      : 0
  const savingsPercent = Math.floor(
    Math.min(100, Math.max(0, rawSavingsPercent))
  )
  const family = getModelFamily(model)

  return {
    modelName: model.model_name,
    vendorName: model.vendor_name?.trim() || getFallbackVendorName(family),
    vendorIcon: model.vendor_icon || model.icon,
    endpointTypes: model.supported_endpoint_types ?? [],
    family,
    baseInputPrice,
    baseOutputPrice,
    baseCacheReadPrice,
    baseCacheWritePrice,
    siteInputPrice,
    siteOutputPrice,
    siteCacheReadPrice,
    siteCacheWritePrice,
    savingsPercent,
  }
}

function getOptionalRatio(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null
  return Math.max(Number(value), 0)
}

export function buildSavingsModels(
  models: PricingModel[],
  priceRate: number
): SavingsModel[] {
  const rankedModels = getRankedPricingModels(models).flatMap((model) => {
    const savings = toSavingsModel(model, priceRate)
    return savings ? [{ model, savings }] : []
  })

  const selectedModels: Array<{ model: PricingModel; savings: SavingsModel }> =
    []
  const selectedNames = new Set<string>()
  const selectedVendors = new Set<string>()

  for (const family of FAMILY_ORDER) {
    const flagship = rankedModels.find(
      (candidate) =>
        !selectedNames.has(candidate.model.model_name) &&
        candidate.savings.family === family
    )
    if (!flagship) continue
    selectedModels.push(flagship)
    selectedNames.add(flagship.model.model_name)
    selectedVendors.add(getVendorKey(flagship.model))
  }

  for (const candidate of rankedModels) {
    if (selectedModels.length >= MAX_COMPARISON_MODELS) break
    if (selectedNames.has(candidate.model.model_name)) continue
    if (selectedVendors.has(getVendorKey(candidate.model))) continue
    selectedModels.push(candidate)
    selectedNames.add(candidate.model.model_name)
    selectedVendors.add(getVendorKey(candidate.model))
  }

  return selectedModels
    .slice(0, MAX_COMPARISON_MODELS)
    .map((candidate) => candidate.savings)
}

function isSavingsPricingModel(model: PricingModel): boolean {
  return (
    model.quota_type === 0 &&
    (isDynamicPricingModel(model) ||
      (Number.isFinite(model.model_ratio) &&
        model.model_ratio > 0 &&
        Number.isFinite(model.completion_ratio) &&
        model.completion_ratio >= 0))
  )
}

function getRankedPricingModels(models: PricingModel[]): PricingModel[] {
  return models.filter(isSavingsPricingModel).sort(compareLatestModel)
}

export function buildSavingsQuote(
  model: PricingModel,
  priceRate: number,
  groupRatio?: number
): SavingsModel | null {
  if (!isSavingsPricingModel(model)) return null
  return toSavingsModel(model, priceRate, groupRatio)
}

/** Build the complete live token-priced catalog used by the calculator. */
export function buildSavingsCatalog(
  models: PricingModel[],
  priceRate: number
): SavingsModel[] {
  return getRankedPricingModels(models).flatMap((model) => {
    const savings = buildSavingsQuote(model, priceRate)
    return savings ? [savings] : []
  })
}

export function formatUsdPerMillion(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  if (amount <= 0) return '$0/M'
  if (amount < 0.01) {
    return `$${amount.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}/M`
  }
  if (amount < 10) return `$${amount.toFixed(2)}/M`
  return `$${amount.toFixed(2)}/M`
}

export function formatPerMillionTokens(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '—'
  return `${formatCnyAmount(amount, { maximumFractionDigits: 4 })}/M`
}

export function formatCnyAmount(
  amount: number,
  options: { compact?: boolean; maximumFractionDigits?: number } = {}
): string {
  const normalizedAmount = Number.isFinite(amount) ? amount : 0
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (Math.abs(normalizedAmount) < 1 ? 4 : 2)

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    notation: options.compact ? 'compact' : 'standard',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(normalizedAmount)
}

export function formatTokenMillions(
  millions: number,
  locale = 'zh-CN'
): string {
  const tokens = Math.max(0, millions) * 1_000_000
  const localeAliases: Record<string, string> = {
    zhcn: 'zh-CN',
    zhtw: 'zh-TW',
  }
  const compactLocale = locale.replaceAll(/[-_]/g, '').toLowerCase()
  const normalizedLocale = localeAliases[compactLocale] ?? locale

  return new Intl.NumberFormat(normalizedLocale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(tokens)
}

export function getMaximumSavingsPercent(
  models: Array<{ savingsPercent: number }>
): number {
  return models.reduce(
    (maximum, model) => Math.max(maximum, model.savingsPercent),
    0
  )
}

function getRepresentativeModels(
  models: SavingsModel[],
  useCase: SavingsUseCase
): SavingsModel[] {
  const representatives: SavingsModel[] = []
  const selectedNames = new Set<string>()

  for (const family of USE_CASES[useCase].families) {
    const model = models.find(
      (candidate) =>
        candidate.family === family && !selectedNames.has(candidate.modelName)
    )
    if (!model) continue
    representatives.push(model)
    selectedNames.add(model.modelName)
    if (representatives.length === 2) return representatives
  }

  for (const model of models) {
    if (selectedNames.has(model.modelName)) continue
    representatives.push(model)
    selectedNames.add(model.modelName)
    if (representatives.length === 2) break
  }

  return representatives
}

export function calculateSavingsEstimate(
  models: SavingsModel[],
  useCase: SavingsUseCase,
  monthlyTokensMillions: number,
  people: number,
  tokenMix: SavingsTokenMix = getDefaultSavingsTokenMix(useCase)
): SavingsEstimate {
  const representativeModels = getRepresentativeModels(models, useCase)
  const normalizedTokenMix = normalizeTokenMix(tokenMix)
  if (representativeModels.length === 0) {
    return {
      representativeModels: [],
      tokenMix: normalizedTokenMix,
      baseMonthlyCost: 0,
      siteMonthlyCost: 0,
      monthlySavings: 0,
      annualSavings: 0,
    }
  }

  let basePricePerMillion = 0
  let sitePricePerMillion = 0

  for (const model of representativeModels) {
    const baseCacheReadPrice = model.baseCacheReadPrice ?? model.baseInputPrice
    const baseCacheWritePrice =
      model.baseCacheWritePrice ?? model.baseInputPrice
    const siteCacheReadPrice = model.siteCacheReadPrice ?? model.siteInputPrice
    const siteCacheWritePrice =
      model.siteCacheWritePrice ?? model.siteInputPrice

    basePricePerMillion +=
      (model.baseInputPrice * normalizedTokenMix.inputPercent +
        baseCacheReadPrice * normalizedTokenMix.cacheReadPercent +
        baseCacheWritePrice * normalizedTokenMix.cacheWritePercent +
        model.baseOutputPrice * normalizedTokenMix.outputPercent) /
      100
    sitePricePerMillion +=
      (model.siteInputPrice * normalizedTokenMix.inputPercent +
        siteCacheReadPrice * normalizedTokenMix.cacheReadPercent +
        siteCacheWritePrice * normalizedTokenMix.cacheWritePercent +
        model.siteOutputPrice * normalizedTokenMix.outputPercent) /
      100
  }

  basePricePerMillion /= representativeModels.length
  sitePricePerMillion /= representativeModels.length

  const normalizedTokens = Math.max(monthlyTokensMillions, 0)
  const normalizedPeople = Math.max(people, 0)
  const baseMonthlyCost =
    basePricePerMillion * normalizedTokens * normalizedPeople
  const siteMonthlyCost =
    sitePricePerMillion * normalizedTokens * normalizedPeople
  const monthlySavings = Math.max(baseMonthlyCost - siteMonthlyCost, 0)

  return {
    representativeModels,
    tokenMix: normalizedTokenMix,
    baseMonthlyCost,
    siteMonthlyCost,
    monthlySavings,
    annualSavings: monthlySavings * 12,
  }
}

export function tokenSliderPositionToMillions(position: number): number {
  const normalizedPosition = Math.min(TOKEN_SLIDER_STEPS, Math.max(0, position))
  const progress = normalizedPosition / TOKEN_SLIDER_STEPS
  const logarithmicValue =
    Math.log(TOKEN_SLIDER_MIN_MILLIONS) +
    progress *
      (Math.log(TOKEN_SLIDER_MAX_MILLIONS) -
        Math.log(TOKEN_SLIDER_MIN_MILLIONS))

  return Math.round(Math.exp(logarithmicValue))
}

export function tokenMillionsToSliderPosition(tokensMillions: number): number {
  const normalizedTokens = Math.min(
    TOKEN_SLIDER_MAX_MILLIONS,
    Math.max(TOKEN_SLIDER_MIN_MILLIONS, tokensMillions)
  )
  const progress =
    (Math.log(normalizedTokens) - Math.log(TOKEN_SLIDER_MIN_MILLIONS)) /
    (Math.log(TOKEN_SLIDER_MAX_MILLIONS) - Math.log(TOKEN_SLIDER_MIN_MILLIONS))

  return Math.round(progress * TOKEN_SLIDER_STEPS)
}
