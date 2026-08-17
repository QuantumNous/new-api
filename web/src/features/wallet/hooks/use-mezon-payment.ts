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

import { getSelf } from '@/lib/api'

import { requestMezonPayment } from '../api'

// ============================================================================
// Mezon Đồng Payment Hook
// ============================================================================

export function useMezonPayment() {
  const [claiming, setClaiming] = useState(false)

  const claimMezonTopup = useCallback(
    async (txHash: string): Promise<boolean> => {
      if (!txHash || txHash.trim() === '') {
        toast.error(i18next.t('Please enter the transaction hash'))
        return false
      }

      try {
        setClaiming(true)
        const response = await requestMezonPayment(txHash.trim())

        if (response.success && response.data) {
          const dong = response.data.dong
          const mzd = response.data.mzd ?? dong
          toast.success(
            i18next.t(
              'Top-up successful! {{dong}} dong → {{mzd}} mzđ (1:1)',
              {
                dong,
                mzd,
              }
            )
          )
          await getSelf()
          return true
        }

        toast.error(response.message || i18next.t('Top-up failed'))
        return false
      } catch (_error) {
        toast.error(i18next.t('Top-up failed'))
        return false
      } finally {
        setClaiming(false)
      }
    },
    []
  )

  return {
    claiming,
    claimMezonTopup,
  }
}
