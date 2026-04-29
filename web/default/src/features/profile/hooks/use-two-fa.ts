import { useState, useEffect, useCallback } from 'react'
import { get2FAStatus } from '@/lib/api'
import type { TwoFAStatus } from '../types'

// ============================================================================
// Two-FA Hook
// ============================================================================

const DEFAULT_STATUS: TwoFAStatus = {
  enabled: false,
  locked: false,
  backup_codes_remaining: 0,
}

export function useTwoFA(enabled = true) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<TwoFAStatus>(DEFAULT_STATUS)

  const fetchStatus = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      const response = await get2FAStatus()
      if (response.success && response.data) {
        setStatus(response.data)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch 2FA status:', error)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    status,
    loading,
    refetch: fetchStatus,
  }
}
