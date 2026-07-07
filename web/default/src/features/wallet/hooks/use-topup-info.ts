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
import { useState, useEffect } from 'react'
import { getTopupInfo } from '../api'
import { PAYMENT_TYPES } from '../constants'
import {
  generatePresetAmounts,
  getLockedTopupAmountOptions,
  mergePresetAmounts,
  getMinTopupAmount,
  shouldRequireConfiguredTopupPackages,
} from '../lib'
import type {
  TopupInfo,
  PresetAmount,
  CreemProduct,
  PaymentMethod,
  WaffoPayMethod,
} from '../types'

// ============================================================================
// Topup Info Hook
// ============================================================================

function parseJsonArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function parsePaymentMethods(
  data: unknown,
  defaultMinTopup: number,
  stripeMinTopup: number,
  paddleMinTopup?: number,
  waffoPancakeMinTopup?: number
): PaymentMethod[] {
  return parseJsonArray(data)
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object'
    )
    .map((item) => {
      const rawMinTopup = Number(item.min_topup)
      const normalizedMinTopup = Number.isFinite(rawMinTopup) ? rawMinTopup : 0
      const type = typeof item.type === 'string' ? item.type : ''

      return {
        name: typeof item.name === 'string' ? item.name : '',
        type,
        color: typeof item.color === 'string' ? item.color : undefined,
        min_topup: getPaymentMethodMinTopup(
          type,
          normalizedMinTopup,
          defaultMinTopup,
          stripeMinTopup,
          paddleMinTopup,
          waffoPancakeMinTopup
        ),
      }
    })
    .filter((item) => item.name && item.type && item.type !== 'waffo')
}

function getPaymentMethodMinTopup(
  type: string,
  value: number,
  defaultMinTopup: number,
  stripeMinTopup: number,
  paddleMinTopup?: number,
  waffoPancakeMinTopup?: number
): number {
  if (value > 0) {
    return value
  }

  if (type === PAYMENT_TYPES.STRIPE) {
    return stripeMinTopup
  }

  if (type === PAYMENT_TYPES.PADDLE) {
    return paddleMinTopup || defaultMinTopup
  }

  if (type === PAYMENT_TYPES.WAFFO_PANCAKE) {
    return waffoPancakeMinTopup || defaultMinTopup
  }

  return defaultMinTopup
}

function parseWaffoPayMethods(data: unknown): WaffoPayMethod[] {
  return parseJsonArray(data)
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object'
    )
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      payMethodType:
        typeof item.payMethodType === 'string' ? item.payMethodType : undefined,
      payMethodName:
        typeof item.payMethodName === 'string' ? item.payMethodName : undefined,
    }))
    .filter((item) => item.name)
}

function parseCreemProducts(data: unknown): CreemProduct[] {
  return parseJsonArray(data)
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object'
    )
    .map((item) => {
      const currency: CreemProduct['currency'] =
        item.currency === 'EUR' ? 'EUR' : 'USD'

      return {
        name: typeof item.name === 'string' ? item.name : '',
        productId: typeof item.productId === 'string' ? item.productId : '',
        price: Number(item.price) || 0,
        quota: Number(item.quota) || 0,
        currency,
      }
    })
    .filter((item) => item.name && item.productId)
}

export function parseAmountOptions(data: unknown): number[] {
  return parseJsonArray(data)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
}

export function parseNumberMap(data: unknown): Record<number, number> {
  if (!data) {
    return {}
  }

  let parsedData = data

  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data)
    } catch {
      return {}
    }
  }

  if (
    !parsedData ||
    typeof parsedData !== 'object' ||
    Array.isArray(parsedData)
  ) {
    return {}
  }

  return Object.entries(parsedData).reduce<Record<number, number>>(
    (result, [key, value]) => {
      const numericKey = Number(key)
      const numericValue = Number(value)

      if (Number.isFinite(numericKey) && Number.isFinite(numericValue)) {
        result[numericKey] = numericValue
      }

      return result
    },
    {}
  )
}

export function useTopupInfo() {
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [presetAmounts, setPresetAmounts] = useState<PresetAmount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTopupInfo = async () => {
    try {
      setLoading(true)

      const response = await getTopupInfo()

      if (!response.success || !response.data) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch topup info:', response.message)
        return
      }

      const processedData: TopupInfo = {
        ...response.data,
        pay_methods: parsePaymentMethods(
          response.data.pay_methods,
          response.data.min_topup,
          response.data.stripe_min_topup,
          response.data.paddle_min_topup,
          response.data.waffo_pancake_min_topup
        ),
        amount_options: parseAmountOptions(response.data.amount_options),
        discount: parseNumberMap(response.data.discount),
        bonus: parseNumberMap(response.data.bonus),
        bonus_remaining: parseNumberMap(response.data.bonus_remaining),
        creem_products: parseCreemProducts(response.data.creem_products),
        waffo_pay_methods: parseWaffoPayMethods(
          response.data.waffo_pay_methods
        ),
      }

      setTopupInfo(processedData)

      const lockedAmountOptions = getLockedTopupAmountOptions(
        processedData.amount_options,
        processedData.enable_stripe_topup
      )

      if (lockedAmountOptions.length > 0) {
        const customPresets = mergePresetAmounts(
          lockedAmountOptions,
          processedData.discount || {},
          processedData.bonus || {},
          processedData.bonus_remaining || {}
        )
        setPresetAmounts(customPresets)
      } else if (shouldRequireConfiguredTopupPackages(processedData)) {
        setPresetAmounts([])
      } else {
        const minTopup = getMinTopupAmount(processedData)
        const defaultPresets = generatePresetAmounts(
          minTopup,
          processedData.bonus || {},
          processedData.bonus_remaining || {}
        )
        setPresetAmounts(defaultPresets)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch topup info:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTopupInfo()
  }, [])

  return {
    topupInfo,
    presetAmounts,
    loading,
    refetch: fetchTopupInfo,
  }
}
