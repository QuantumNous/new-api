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
import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { createInviteCodes, transferAffiliateQuota } from '../api'

export function useAffiliate() {
  const [createdInviteCodes, setCreatedInviteCodes] = useState<string[]>([])
  const [transferring, setTransferring] = useState(false)
  const [creatingInviteCode, setCreatingInviteCode] = useState(false)

  const transferQuota = useCallback(async (quota: number): Promise<boolean> => {
    try {
      setTransferring(true)
      const response = await transferAffiliateQuota({ quota })

      if (response.success) {
        toast.success(response.message || i18next.t('Transfer successful'))
        await getSelf()
        return true
      }

      toast.error(response.message || i18next.t('Transfer failed'))
      return false
    } catch (_error) {
      toast.error(i18next.t('Transfer failed'))
      return false
    } finally {
      setTransferring(false)
    }
  }, [])

  const createInviteCode = useCallback(async (count = 1): Promise<boolean> => {
    const normalizedCount = Math.max(1, Math.min(100, Number(count) || 1))
    try {
      setCreatingInviteCode(true)
      const response = await createInviteCodes({
        name: 'invite',
        count: normalizedCount,
        max_uses: 1,
      })

      if (response.success && response.data?.length) {
        setCreatedInviteCodes(response.data)
        toast.success(
          response.message ||
            i18next.t(
              normalizedCount > 1
                ? 'Invitation codes created successfully'
                : 'Invitation code created successfully'
            )
        )
        return true
      }

      toast.error(
        response.message || i18next.t('Failed to create invitation code')
      )
      return false
    } catch (_error) {
      toast.error(i18next.t('Failed to create invitation code'))
      return false
    } finally {
      setCreatingInviteCode(false)
    }
  }, [])

  return {
    transferring,
    creatingInviteCode,
    createdInviteCodes,
    transferQuota,
    createInviteCode,
  }
}
