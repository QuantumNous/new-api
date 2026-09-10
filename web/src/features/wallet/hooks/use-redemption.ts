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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { formatQuota } from '@/lib/format'

import { redeemCode as redeemTypedCode } from '../api'
import { executeRedemption, formatRedemptionEndTime } from '../lib/redemption'

// ============================================================================
// Redemption Hook
// ============================================================================

type UseRedemptionOptions = {
  refreshUser: () => void | Promise<void>
  refreshSubscriptions: () => void | Promise<void>
}

export function useRedemption(options: UseRedemptionOptions) {
  const [redeeming, setRedeeming] = useState(false)

  const redeemCode = useCallback(
    async (code: string): Promise<boolean> => {
      const key = code.trim()
      if (!key) {
        toast.error(i18next.t('Please enter a redemption code'))
        return false
      }

      try {
        setRedeeming(true)
        return await executeRedemption(key, {
          redeem: redeemTypedCode,
          formatQuota,
          formatEndTime: (endTime) =>
            formatRedemptionEndTime(endTime, i18next.language),
          notifySuccess: (notice) => {
            if (notice.type === 'quota') {
              toast.success(
                i18next.t('Redemption successful! Added: {{quota}}', {
                  quota: notice.quota,
                })
              )
              return
            }
            toast.success(
              i18next.t('Subscription redeemed: {{plan}} · expires {{date}}', {
                plan: notice.planTitle,
                date: notice.endDate,
              })
            )
          },
          notifyFailure: () => toast.error(i18next.t('Redemption failed')),
          refreshUser: options.refreshUser,
          refreshSubscriptions: options.refreshSubscriptions,
        })
      } finally {
        setRedeeming(false)
      }
    },
    [options.refreshSubscriptions, options.refreshUser]
  )

  return {
    redeeming,
    redeemCode,
  }
}
