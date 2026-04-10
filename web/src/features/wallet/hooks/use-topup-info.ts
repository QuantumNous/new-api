import { useState, useEffect } from 'react'
import { getTopupInfo } from '../api'
import {
  generatePresetAmounts,
  mergePresetAmounts,
  getMinTopupAmount,
} from '../lib'
import type { TopupInfo, PresetAmount, CreemProduct } from '../types'

// ============================================================================
// Topup Info Hook
// ============================================================================

/**
 * Parse creem_products from backend response
 * Backend returns it as a JSON string, need to parse it
 */
function parseCreemProducts(data: unknown): CreemProduct[] {
  if (!data) return []

  // If already an array, return as-is
  if (Array.isArray(data)) {
    return data
  }

  // If it's a string, try to parse it
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

      // Parse creem_products from JSON string if needed
      const processedData: TopupInfo = {
        ...response.data,
        creem_products: parseCreemProducts(response.data.creem_products),
      }

      setTopupInfo(processedData)

      // Generate preset amounts
      if (response.data.amount_options?.length > 0) {
        // Use custom preset amounts with discounts
        const customPresets = mergePresetAmounts(
          response.data.amount_options,
          response.data.discount || {}
        )
        setPresetAmounts(customPresets)
      } else {
        // Generate default preset amounts based on min_topup
        const minTopup = getMinTopupAmount(response.data)
        const defaultPresets = generatePresetAmounts(minTopup)
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
