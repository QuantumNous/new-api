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
import * as z from 'zod'

import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'

import { safeJsonParse } from '../utils/json-parser'
import { formatPricingNumber } from './pricing-format'

export const createModelPricingSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
    ratio: z.string().optional(),
    cacheRatio: z.string().optional(),
    createCacheRatio: z.string().optional(),
    completionRatio: z.string().optional(),
    imageRatio: z.string().optional(),
    audioRatio: z.string().optional(),
    audioCompletionRatio: z.string().optional(),
  })

export type ModelPricingFormValues = z.infer<
  ReturnType<typeof createModelPricingSchema>
>

export type PricingMode = 'per-token' | 'per-request' | 'tiered_expr'

export type LaneKey =
  | 'completion'
  | 'cache'
  | 'createCache'
  | 'image'
  | 'audioInput'
  | 'audioOutput'

export type ModelRatioData = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: PricingMode
  billingExpr?: string
  requestRuleExpr?: string
}

export type ModelPricingOptionInput = {
  modelPrice: string
  modelRatio: string
  cacheRatio: string
  createCacheRatio: string
  completionRatio: string
  imageRatio: string
  audioRatio: string
  audioCompletionRatio: string
  billingMode: string
  billingExpr: string
}

export type ModelPricingOptionUpdates = {
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  'billing_setting.billing_mode': string
  'billing_setting.billing_expr': string
}

type NumericOptionCurrentKey =
  | 'modelPrice'
  | 'modelRatio'
  | 'cacheRatio'
  | 'createCacheRatio'
  | 'completionRatio'
  | 'imageRatio'
  | 'audioRatio'
  | 'audioCompletionRatio'

type NumericOptionOutputKey =
  | 'ModelPrice'
  | 'ModelRatio'
  | 'CacheRatio'
  | 'CreateCacheRatio'
  | 'CompletionRatio'
  | 'ImageRatio'
  | 'AudioRatio'
  | 'AudioCompletionRatio'

type NumericOptionDataKey =
  | 'price'
  | 'ratio'
  | 'cacheRatio'
  | 'createCacheRatio'
  | 'completionRatio'
  | 'imageRatio'
  | 'audioRatio'
  | 'audioCompletionRatio'

const pricingMapFields: Array<{
  currentKey: NumericOptionCurrentKey
  outputKey: NumericOptionOutputKey
  dataKey: NumericOptionDataKey
}> = [
  { currentKey: 'modelPrice', outputKey: 'ModelPrice', dataKey: 'price' },
  { currentKey: 'modelRatio', outputKey: 'ModelRatio', dataKey: 'ratio' },
  { currentKey: 'cacheRatio', outputKey: 'CacheRatio', dataKey: 'cacheRatio' },
  {
    currentKey: 'createCacheRatio',
    outputKey: 'CreateCacheRatio',
    dataKey: 'createCacheRatio',
  },
  {
    currentKey: 'completionRatio',
    outputKey: 'CompletionRatio',
    dataKey: 'completionRatio',
  },
  { currentKey: 'imageRatio', outputKey: 'ImageRatio', dataKey: 'imageRatio' },
  { currentKey: 'audioRatio', outputKey: 'AudioRatio', dataKey: 'audioRatio' },
  {
    currentKey: 'audioCompletionRatio',
    outputKey: 'AudioCompletionRatio',
    dataKey: 'audioCompletionRatio',
  },
]

const priceMapField = pricingMapFields[0]
const ratioMapFields = pricingMapFields.slice(1)

export type PreviewRow = {
  key: string
  label: string
  value: string
  multiline?: boolean
}

export const numericDraftRegex = /^(\d+(\.\d*)?|\.\d*)?$/

export const EMPTY_LANE_PRICES: Record<LaneKey, string> = {
  completion: '',
  cache: '',
  createCache: '',
  image: '',
  audioInput: '',
  audioOutput: '',
}

export const EMPTY_LANE_ENABLED: Record<LaneKey, boolean> = {
  completion: false,
  cache: false,
  createCache: false,
  image: false,
  audioInput: false,
  audioOutput: false,
}

export const ratioFieldByLane: Record<LaneKey, keyof ModelPricingFormValues> = {
  completion: 'completionRatio',
  cache: 'cacheRatio',
  createCache: 'createCacheRatio',
  image: 'imageRatio',
  audioInput: 'audioRatio',
  audioOutput: 'audioCompletionRatio',
}

export const laneConfigs: Array<{
  key: LaneKey
  titleKey: string
  descriptionKey: string
  placeholder: string
}> = [
  {
    key: 'completion',
    titleKey: 'Completion price',
    descriptionKey: 'Output token price for generated tokens.',
    placeholder: '15',
  },
  {
    key: 'cache',
    titleKey: 'Cache read price',
    descriptionKey: 'Token price for cache reads.',
    placeholder: '0.3',
  },
  {
    key: 'createCache',
    titleKey: 'Cache write price',
    descriptionKey: 'Token price for creating cache entries.',
    placeholder: '3.75',
  },
  {
    key: 'image',
    titleKey: 'Image input price',
    descriptionKey: 'Token price for image input.',
    placeholder: '2.5',
  },
  {
    key: 'audioInput',
    titleKey: 'Audio input price',
    descriptionKey: 'Token price for audio input.',
    placeholder: '3.81',
  },
  {
    key: 'audioOutput',
    titleKey: 'Audio output price',
    descriptionKey: 'Token price for audio output.',
    placeholder: '15.11',
  },
]

export function hasValue(value: unknown): boolean {
  return (
    value !== '' && value !== null && value !== undefined && value !== false
  )
}

export function toNumberOrNull(value: unknown): number | null {
  if (!hasValue(value) && value !== 0) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function buildModelPricingOptionUpdates({
  current,
  data,
  targetNames = [data.name],
}: {
  current: ModelPricingOptionInput
  data: ModelRatioData
  targetNames?: string[]
}): ModelPricingOptionUpdates {
  const pricingMaps = Object.fromEntries(
    pricingMapFields.map((field) => [
      field.outputKey,
      safeJsonParse<Record<string, number>>(current[field.currentKey], {
        fallback: {},
        silent: true,
      }),
    ])
  ) as Record<NumericOptionOutputKey, Record<string, number>>

  const priceMap = pricingMaps.ModelPrice

  const setFieldIfPresent = (
    field: (typeof pricingMapFields)[number],
    name: string
  ) => {
    setIfPresent(pricingMaps[field.outputKey], name, data[field.dataKey])
  }

  const setFieldsIfPresent = (
    fields: typeof pricingMapFields,
    name: string
  ) => {
    fields.forEach((field) => setFieldIfPresent(field, name))
  }

  const billingModeMap = safeJsonParse<Record<string, string>>(
    current.billingMode,
    { fallback: {}, silent: true }
  )
  const billingExprMap = safeJsonParse<Record<string, string>>(
    current.billingExpr,
    { fallback: {}, silent: true }
  )

  const setIfPresent = (
    target: Record<string, number>,
    name: string,
    value: string | undefined
  ) => {
    if (!value || value === '') return
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) target[name] = parsed
  }

  targetNames.forEach((name) => {
    pricingMapFields.forEach((field) => {
      delete pricingMaps[field.outputKey][name]
    })
    delete billingModeMap[name]
    delete billingExprMap[name]

    const mode =
      data.billingMode ||
      (data.price && data.price !== '' ? 'per-request' : 'per-token')

    if (mode === 'tiered_expr') {
      const combined = combineBillingExpr(
        data.billingExpr || '',
        data.requestRuleExpr || ''
      )
      if (combined) {
        billingModeMap[name] = 'tiered_expr'
        billingExprMap[name] = combined
      }
      setFieldsIfPresent(pricingMapFields, name)
      return
    }

    if (mode === 'per-request') {
      setFieldIfPresent(priceMapField, name)
      return
    }

    setFieldsIfPresent(ratioMapFields, name)
  })

  return {
    ModelPrice: JSON.stringify(priceMap, null, 2),
    ModelRatio: JSON.stringify(pricingMaps.ModelRatio, null, 2),
    CacheRatio: JSON.stringify(pricingMaps.CacheRatio, null, 2),
    CreateCacheRatio: JSON.stringify(pricingMaps.CreateCacheRatio, null, 2),
    CompletionRatio: JSON.stringify(pricingMaps.CompletionRatio, null, 2),
    ImageRatio: JSON.stringify(pricingMaps.ImageRatio, null, 2),
    AudioRatio: JSON.stringify(pricingMaps.AudioRatio, null, 2),
    AudioCompletionRatio: JSON.stringify(
      pricingMaps.AudioCompletionRatio,
      null,
      2
    ),
    'billing_setting.billing_mode': JSON.stringify(billingModeMap, null, 2),
    'billing_setting.billing_expr': JSON.stringify(billingExprMap, null, 2),
  }
}

function ratioToBasePrice(ratio: unknown): string {
  const num = toNumberOrNull(ratio)
  if (num === null) return ''
  return formatPricingNumber(num * 2)
}

function deriveLanePrice(
  ratio: unknown,
  denominator: unknown,
  fallback = ''
): string {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = toNumberOrNull(denominator)
  if (ratioNumber === null || denominatorNumber === null) return fallback
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

export function createInitialLaneState(data?: ModelRatioData | null) {
  if (!data) {
    return {
      promptPrice: '',
      prices: { ...EMPTY_LANE_PRICES },
      enabled: { ...EMPTY_LANE_ENABLED },
    }
  }

  const promptPrice = ratioToBasePrice(data.ratio)
  const audioInputPrice = deriveLanePrice(data.audioRatio, promptPrice)
  const prices: Record<LaneKey, string> = {
    completion: deriveLanePrice(data.completionRatio, promptPrice),
    cache: deriveLanePrice(data.cacheRatio, promptPrice),
    createCache: deriveLanePrice(data.createCacheRatio, promptPrice),
    image: deriveLanePrice(data.imageRatio, promptPrice),
    audioInput: audioInputPrice,
    audioOutput: deriveLanePrice(data.audioCompletionRatio, audioInputPrice),
  }

  return {
    promptPrice,
    prices,
    enabled: {
      completion: hasValue(data.completionRatio),
      cache: hasValue(data.cacheRatio),
      createCache: hasValue(data.createCacheRatio),
      image: hasValue(data.imageRatio),
      audioInput: hasValue(data.audioRatio),
      audioOutput: hasValue(data.audioCompletionRatio),
    },
  }
}

export function buildPreviewRows(
  values: ModelPricingFormValues,
  mode: PricingMode,
  billingExpr: string,
  requestRuleExpr: string,
  promptPrice: string,
  lanePrices: Record<LaneKey, string>,
  laneEnabled: Record<LaneKey, boolean>,
  t: (key: string) => string
): PreviewRow[] {
  if (mode === 'tiered_expr') {
    const effectiveExpr = combineBillingExpr(billingExpr, requestRuleExpr)
    return [
      { key: 'mode', label: 'BillingMode', value: 'tiered_expr' },
      {
        key: 'expr',
        label: t('Expression'),
        value: effectiveExpr || t('Empty'),
        multiline: true,
      },
    ]
  }

  if (mode === 'per-request') {
    return [
      {
        key: 'price',
        label: 'ModelPrice',
        value: values.price || t('Empty'),
      },
    ]
  }

  return [
    {
      key: 'inputPrice',
      label: t('Input price'),
      value: promptPrice ? `$${promptPrice}` : t('Empty'),
    },
    {
      key: 'completion',
      label: t('Completion price'),
      value:
        laneEnabled.completion && lanePrices.completion
          ? `$${lanePrices.completion}`
          : t('Empty'),
    },
    {
      key: 'cache',
      label: t('Cache read price'),
      value:
        laneEnabled.cache && lanePrices.cache
          ? `$${lanePrices.cache}`
          : t('Empty'),
    },
    {
      key: 'createCache',
      label: t('Cache write price'),
      value:
        laneEnabled.createCache && lanePrices.createCache
          ? `$${lanePrices.createCache}`
          : t('Empty'),
    },
    {
      key: 'image',
      label: t('Image input price'),
      value:
        laneEnabled.image && lanePrices.image
          ? `$${lanePrices.image}`
          : t('Empty'),
    },
    {
      key: 'audio',
      label: t('Audio input price'),
      value:
        laneEnabled.audioInput && lanePrices.audioInput
          ? `$${lanePrices.audioInput}`
          : t('Empty'),
    },
    {
      key: 'audioCompletion',
      label: t('Audio output price'),
      value:
        laneEnabled.audioOutput && lanePrices.audioOutput
          ? `$${lanePrices.audioOutput}`
          : t('Empty'),
    },
  ]
}
