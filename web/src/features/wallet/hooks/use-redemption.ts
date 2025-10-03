import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { redeemTopupCode } from '../api'

// ============================================================================
// Redemption Hook
// ============================================================================

export function useRedemption() {
  const [redeeming, setRedeeming] = useState(false)

  const redeemCode = useCallback(async (code: string): Promise<boolean> => {
    if (!code || code.trim() === '') {
      toast.error('Please enter a redemption code')
      return false
    }

    try {
      setRedeeming(true)
      const response = await redeemTopupCode({ key: code })

      if (response.success && response.data) {
        const quotaAdded = response.data
        toast.success(
          `Redemption successful! Added: ${formatQuota(quotaAdded)}`
        )
        await getSelf()
        return true
      }

      toast.error(response.message || 'Redemption failed')
      return false
    } catch (error) {
      toast.error('Redemption failed')
      return false
    } finally {
      setRedeeming(false)
    }
  }, [])

  return {
    redeeming,
    redeemCode,
  }
}
