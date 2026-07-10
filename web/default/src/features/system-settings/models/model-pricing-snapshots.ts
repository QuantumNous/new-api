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
import { splitBillingExprAndRequestRules } from '@/features/pricing/lib/billing-expr'

import { safeJsonParse } from '../utils/json-parser'
import { formatPricingNumber } from './pricing-format'

export type ModelPricingSnapshotInput = {
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
  imageModelSetting: string
  videoModelSetting: string
}

export type ModelPricingSnapshot = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: string
  billingExpr?: string
  requestRuleExpr?: string
  price1k?: string
  price2k?: string
  price4k?: string
  priceMatrixJson?: string
  videoPriceMatrixJson?: string
  videoDefaultSeconds?: string
  perRequestSubMode?: 'fixed' | 'per-resolution' | 'per-second'
  hasConflict: boolean
}

export type ModelRow = ModelPricingSnapshot & {
  saved?: ModelPricingSnapshot
  draft?: ModelPricingSnapshot
  isDraftChanged: boolean
  isDraftDeleted: boolean
  isDraftNew: boolean
}

export const hasPricingValue = (value?: string) =>
  value !== undefined && value !== ''

export const isBasePricingUnset = (snapshot?: ModelPricingSnapshot) =>
  !snapshot ||
  (snapshot.billingMode !== 'tiered_expr' &&
    !hasPricingValue(snapshot.price) &&
    !hasPricingValue(snapshot.ratio))

const toNumberOrNull = (value?: string) => {
  if (!hasPricingValue(value)) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const ratioToPrice = (ratio?: string, denominator?: string) => {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = denominator ? toNumberOrNull(denominator) : 2
  if (ratioNumber === null || denominatorNumber === null) return ''
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

export const getModeLabel = (mode?: string, subMode?: string) => {
  if (mode === 'per-request') {
    if (subMode === 'per-resolution') return 'Per-resolution'
    if (subMode === 'per-second') return 'Per-second'
    return 'Per-request'
  }
  if (mode === 'tiered_expr') return 'Expression'
  return 'Per-token'
}

export const getModeVariant = (
  mode?: string,
  subMode?: string
): 'warning' | 'info' | 'success' | 'orange' | 'purple' => {
  if (mode === 'per-request') {
    if (subMode === 'per-resolution') return 'orange'
    if (subMode === 'per-second') return 'purple'
    return 'warning'
  }
  if (mode === 'tiered_expr') return 'info'
  return 'success'
}

const getExpressionSummary = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  const tierCount = (row.billingExpr?.match(/tier\(/g) || []).length
  if (tierCount > 0) {
    return `${t('Tiered pricing')} · ${tierCount} ${t('tiers')}`
  }
  return t('Expression pricing')
}

export const getPriceSummary = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  if (row.billingMode === 'tiered_expr') {
    return getExpressionSummary(row, t)
  }
  if (row.billingMode === 'per-request') {
    if (row.perRequestSubMode === 'per-resolution') {
      const prices = [
        row.price1k && `1K $${row.price1k}`,
        row.price2k && `2K $${row.price2k}`,
        row.price4k && `4K $${row.price4k}`,
      ].filter(Boolean)
      return prices.join(' · ') || t('Per-resolution (default prices)')
    }
    if (row.perRequestSubMode === 'per-second') {
      const matrix = safeJsonParse<Record<string, number>>(
        row.videoPriceMatrixJson || '{}',
        { fallback: {}, silent: true }
      )
      const prices = ['480p', '720p', '1080p', '4k', 'default']
        .filter((key) => matrix[key] != null)
        .map((key) => `${key} $${matrix[key]}`)
      return prices.length > 0
        ? `${prices.join(' · ')} / ${t('sec')}`
        : t('Per-second (default prices)')
    }
    return row.price ? `$${row.price} / ${t('request')}` : t('Unset price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('Unset price')

  const extraCount = [
    row.completionRatio,
    row.cacheRatio,
    row.createCacheRatio,
    row.imageRatio,
    row.audioRatio,
    row.audioCompletionRatio,
  ].filter(hasPricingValue).length

  return extraCount > 0
    ? `${t('Input')} $${inputPrice} · ${extraCount} ${t('extras')}`
    : `${t('Input')} $${inputPrice}`
}

export const getPriceDetail = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  if (row.billingMode === 'tiered_expr') {
    return row.requestRuleExpr
      ? t('Includes request rules')
      : t('Expression based')
  }
  if (row.billingMode === 'per-request') {
    if (row.perRequestSubMode === 'per-resolution') {
      return t('Flat price per image by output resolution')
    }
    if (row.perRequestSubMode === 'per-second') {
      return t('Per-second video pricing by output resolution')
    }
    return t('Fixed request price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('No base input price')

  const details = [
    row.completionRatio &&
      `${t('Output')} $${ratioToPrice(row.completionRatio, inputPrice)}`,
    row.cacheRatio &&
      `${t('Cache')} $${ratioToPrice(row.cacheRatio, inputPrice)}`,
    row.createCacheRatio &&
      `${t('Cache write')} $${ratioToPrice(row.createCacheRatio, inputPrice)}`,
  ]
    .filter(Boolean)
    .slice(0, 2)

  return details.length > 0 ? details.join(' · ') : t('Base input price only')
}

export const buildModelSnapshots = ({
  modelPrice,
  modelRatio,
  cacheRatio,
  createCacheRatio,
  completionRatio,
  imageRatio,
  audioRatio,
  audioCompletionRatio,
  billingMode,
  billingExpr,
  imageModelSetting,
  videoModelSetting,
}: ModelPricingSnapshotInput): ModelPricingSnapshot[] => {
  const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
    fallback: {},
    context: 'model prices',
  })
  const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
    fallback: {},
    context: 'model ratios',
  })
  const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
    fallback: {},
    context: 'cache ratios',
  })
  const createCacheMap = safeJsonParse<Record<string, number>>(
    createCacheRatio,
    { fallback: {}, context: 'create cache ratios' }
  )
  const completionMap = safeJsonParse<Record<string, number>>(completionRatio, {
    fallback: {},
    context: 'completion ratios',
  })
  const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
    fallback: {},
    context: 'image ratios',
  })
  const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
    fallback: {},
    context: 'audio ratios',
  })
  const audioCompletionMap = safeJsonParse<Record<string, number>>(
    audioCompletionRatio,
    { fallback: {}, context: 'audio completion ratios' }
  )
  const billingModeMap = safeJsonParse<Record<string, string>>(billingMode, {
    fallback: {},
    context: 'billing mode',
  })
  const billingExprMap = safeJsonParse<Record<string, string>>(billingExpr, {
    fallback: {},
    context: 'billing expression',
  })
  const imageSettings = safeJsonParse<
    Record<
      string,
      {
        billing_mode?: string
        price_1k?: number
        price_2k?: number
        price_4k?: number
        price_matrix?: Record<string, number>
      }
    >
  >(imageModelSetting, { fallback: {}, silent: true })
  const videoSettings = safeJsonParse<
    Record<
      string,
      {
        billing_mode?: string
        default_seconds?: number
        price_matrix?: Record<string, number>
      }
    >
  >(videoModelSetting, { fallback: {}, silent: true })

  const modelNames = new Set([
    ...Object.keys(priceMap),
    ...Object.keys(ratioMap),
    ...Object.keys(cacheMap),
    ...Object.keys(createCacheMap),
    ...Object.keys(completionMap),
    ...Object.keys(imageMap),
    ...Object.keys(audioMap),
    ...Object.keys(audioCompletionMap),
    ...Object.keys(billingModeMap),
    ...Object.keys(billingExprMap),
    ...Object.keys(imageSettings),
    ...Object.keys(videoSettings),
  ])

  return Array.from(modelNames).map((name) => {
    const price = priceMap[name]?.toString() || ''
    const ratio = ratioMap[name]?.toString() || ''
    const cache = cacheMap[name]?.toString() || ''
    const createCache = createCacheMap[name]?.toString() || ''
    const completion = completionMap[name]?.toString() || ''
    const image = imageMap[name]?.toString() || ''
    const audio = audioMap[name]?.toString() || ''
    const audioCompletion = audioCompletionMap[name]?.toString() || ''
    const imageSetting = imageSettings[name]
    const videoSetting = videoSettings[name]
    const isPerResolution = imageSetting?.billing_mode === 'per_size'
    const isPerSecond = videoSetting?.billing_mode === 'per_second'

    const modeForModel = billingModeMap[name]
    if (modeForModel === 'tiered_expr') {
      const fullExpr = billingExprMap[name] || ''
      const { billingExpr: pureExpr, requestRuleExpr } =
        splitBillingExprAndRequestRules(fullExpr)
      return {
        name,
        billingMode: 'tiered_expr',
        billingExpr: pureExpr,
        requestRuleExpr,
        price,
        ratio,
        cacheRatio: cache,
        createCacheRatio: createCache,
        completionRatio: completion,
        imageRatio: image,
        audioRatio: audio,
        audioCompletionRatio: audioCompletion,
        hasConflict: false,
      }
    }

    return {
      name,
      price,
      ratio,
      cacheRatio: cache,
      createCacheRatio: createCache,
      completionRatio: completion,
      imageRatio: image,
      audioRatio: audio,
      audioCompletionRatio: audioCompletion,
      billingMode:
        price !== '' || isPerResolution || isPerSecond
          ? 'per-request'
          : 'per-token',
      perRequestSubMode: isPerSecond
        ? 'per-second'
        : isPerResolution
          ? 'per-resolution'
          : 'fixed',
      price1k:
        imageSetting?.price_1k != null ? String(imageSetting.price_1k) : '',
      price2k:
        imageSetting?.price_2k != null ? String(imageSetting.price_2k) : '',
      price4k:
        imageSetting?.price_4k != null ? String(imageSetting.price_4k) : '',
      priceMatrixJson: imageSetting?.price_matrix
        ? JSON.stringify(imageSetting.price_matrix, null, 2)
        : '',
      videoPriceMatrixJson: videoSetting?.price_matrix
        ? JSON.stringify(videoSetting.price_matrix, null, 2)
        : '',
      videoDefaultSeconds:
        videoSetting?.default_seconds != null
          ? String(videoSetting.default_seconds)
          : isPerSecond
            ? '5'
            : '',
      hasConflict:
        price !== '' &&
        (ratio !== '' ||
          completion !== '' ||
          cache !== '' ||
          createCache !== '' ||
          image !== '' ||
          audio !== '' ||
          audioCompletion !== ''),
    }
  })
}

export const getSnapshotSignature = (snapshot?: ModelPricingSnapshot) => {
  if (!snapshot) return ''
  return JSON.stringify({
    price: snapshot.price || '',
    ratio: snapshot.ratio || '',
    cacheRatio: snapshot.cacheRatio || '',
    createCacheRatio: snapshot.createCacheRatio || '',
    completionRatio: snapshot.completionRatio || '',
    imageRatio: snapshot.imageRatio || '',
    audioRatio: snapshot.audioRatio || '',
    audioCompletionRatio: snapshot.audioCompletionRatio || '',
    billingMode: snapshot.billingMode || 'per-token',
    billingExpr: snapshot.billingExpr || '',
    requestRuleExpr: snapshot.requestRuleExpr || '',
    price1k: snapshot.price1k || '',
    price2k: snapshot.price2k || '',
    price4k: snapshot.price4k || '',
    priceMatrixJson: snapshot.priceMatrixJson || '',
    videoPriceMatrixJson: snapshot.videoPriceMatrixJson || '',
    videoDefaultSeconds: snapshot.videoDefaultSeconds || '',
    perRequestSubMode: snapshot.perRequestSubMode || 'fixed',
  })
}
