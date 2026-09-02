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
import { getDisplayGroupRatio } from '@/features/pricing/lib/model-helpers'
import type { PricingModel } from '@/features/pricing/types'

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
  family: ModelFamily
  officialInputPrice: number
  officialOutputPrice: number
  officialCacheReadPrice: number | null
  officialCacheWritePrice: number | null
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
  officialMonthlyCost: number
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
  usdExchangeRate: number
): SavingsModel {
  const officialInputPrice =
    model.model_ratio * 2 * Math.max(usdExchangeRate, 0.001)
  const officialOutputPrice = officialInputPrice * model.completion_ratio
  const displayGroupRatio = Math.max(getDisplayGroupRatio(model), 0)
  const siteInputPrice =
    model.model_ratio * 2 * displayGroupRatio * Math.max(priceRate, 0.001)
  const siteOutputPrice = siteInputPrice * model.completion_ratio
  const cacheRatio = getOptionalRatio(model.cache_ratio)
  const cacheWriteRatio = getOptionalRatio(model.create_cache_ratio)
  const rawSavingsPercent = (1 - siteInputPrice / officialInputPrice) * 100
  const savingsPercent = Math.floor(
    Math.min(100, Math.max(0, rawSavingsPercent))
  )
  const family = getModelFamily(model)

  return {
    modelName: model.model_name,
    vendorName: model.vendor_name?.trim() || getFallbackVendorName(family),
    family,
    officialInputPrice,
    officialOutputPrice,
    officialCacheReadPrice:
      cacheRatio == null ? null : officialInputPrice * cacheRatio,
    officialCacheWritePrice:
      cacheWriteRatio == null ? null : officialInputPrice * cacheWriteRatio,
    siteInputPrice,
    siteOutputPrice,
    siteCacheReadPrice: cacheRatio == null ? null : siteInputPrice * cacheRatio,
    siteCacheWritePrice:
      cacheWriteRatio == null ? null : siteInputPrice * cacheWriteRatio,
    savingsPercent,
  }
}

function getOptionalRatio(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null
  return Math.max(Number(value), 0)
}

export function buildSavingsModels(
  models: PricingModel[],
  priceRate: number,
  usdExchangeRate: number
): SavingsModel[] {
  const rankedModels = getRankedPricingModels(models)

  const selectedModels: PricingModel[] = []
  const selectedNames = new Set<string>()
  const selectedVendors = new Set<string>()

  for (const family of FAMILY_ORDER) {
    const flagship = rankedModels.find(
      (model) =>
        !selectedNames.has(model.model_name) && getModelFamily(model) === family
    )
    if (!flagship) continue
    selectedModels.push(flagship)
    selectedNames.add(flagship.model_name)
    selectedVendors.add(getVendorKey(flagship))
  }

  for (const model of rankedModels) {
    if (selectedModels.length >= MAX_COMPARISON_MODELS) break
    if (selectedNames.has(model.model_name)) continue
    if (selectedVendors.has(getVendorKey(model))) continue
    selectedModels.push(model)
    selectedNames.add(model.model_name)
    selectedVendors.add(getVendorKey(model))
  }

  return selectedModels
    .slice(0, MAX_COMPARISON_MODELS)
    .map((model) => toSavingsModel(model, priceRate, usdExchangeRate))
}

function getRankedPricingModels(models: PricingModel[]): PricingModel[] {
  return models
    .filter(
      (model) =>
        model.quota_type === 0 &&
        Number.isFinite(model.model_ratio) &&
        model.model_ratio > 0 &&
        Number.isFinite(model.completion_ratio) &&
        model.completion_ratio >= 0
    )
    .sort(compareLatestModel)
}

/** Build the complete live token-priced catalog used by the calculator. */
export function buildSavingsCatalog(
  models: PricingModel[],
  priceRate: number,
  usdExchangeRate: number
): SavingsModel[] {
  return getRankedPricingModels(models).map((model) =>
    toSavingsModel(model, priceRate, usdExchangeRate)
  )
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

export function getMaximumSavingsPercent(models: SavingsModel[]): number {
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
      officialMonthlyCost: 0,
      siteMonthlyCost: 0,
      monthlySavings: 0,
      annualSavings: 0,
    }
  }

  let officialPricePerMillion = 0
  let sitePricePerMillion = 0

  for (const model of representativeModels) {
    const officialCacheReadPrice =
      model.officialCacheReadPrice ?? model.officialInputPrice
    const officialCacheWritePrice =
      model.officialCacheWritePrice ?? model.officialInputPrice
    const siteCacheReadPrice = model.siteCacheReadPrice ?? model.siteInputPrice
    const siteCacheWritePrice =
      model.siteCacheWritePrice ?? model.siteInputPrice

    officialPricePerMillion +=
      (model.officialInputPrice * normalizedTokenMix.inputPercent +
        officialCacheReadPrice * normalizedTokenMix.cacheReadPercent +
        officialCacheWritePrice * normalizedTokenMix.cacheWritePercent +
        model.officialOutputPrice * normalizedTokenMix.outputPercent) /
      100
    sitePricePerMillion +=
      (model.siteInputPrice * normalizedTokenMix.inputPercent +
        siteCacheReadPrice * normalizedTokenMix.cacheReadPercent +
        siteCacheWritePrice * normalizedTokenMix.cacheWritePercent +
        model.siteOutputPrice * normalizedTokenMix.outputPercent) /
      100
  }

  officialPricePerMillion /= representativeModels.length
  sitePricePerMillion /= representativeModels.length

  const normalizedTokens = Math.max(monthlyTokensMillions, 0)
  const normalizedPeople = Math.max(people, 0)
  const officialMonthlyCost =
    officialPricePerMillion * normalizedTokens * normalizedPeople
  const siteMonthlyCost =
    sitePricePerMillion * normalizedTokens * normalizedPeople
  const monthlySavings = Math.max(officialMonthlyCost - siteMonthlyCost, 0)

  return {
    representativeModels,
    tokenMix: normalizedTokenMix,
    officialMonthlyCost,
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
