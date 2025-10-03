import { useState, useEffect } from 'react'
import { getTopupInfo } from '../api'
import {
  generatePresetAmounts,
  mergePresetAmounts,
  getMinTopupAmount,
} from '../lib'
import type { TopupInfo, PresetAmount } from '../types'

// ============================================================================
// Topup Info Hook
// ============================================================================

export function useTopupInfo() {
  const [topupInfo, setTopupInfo] = useState<TopupInfo | null>(null)
  const [presetAmounts, setPresetAmounts] = useState<PresetAmount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTopupInfo = async () => {
    try {
      setLoading(true)

      const response = await getTopupInfo()

      if (!response.success || !response.data) {
        console.error('Failed to fetch topup info:', response.message)
        return
      }

      setTopupInfo(response.data)

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
