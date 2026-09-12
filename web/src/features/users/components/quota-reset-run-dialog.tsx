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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { runQuotaResetNow } from '../api'
import { useUsers } from './users-provider'

interface QuotaResetRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuotaResetRunDialog(props: QuotaResetRunDialogProps) {
  const { t } = useTranslation()
  const { triggerRefresh } = useUsers()
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const result = await runQuotaResetNow()
      if (result.success) {
        props.onOpenChange(false)
        toast.success(
          t('Reset quota for {{count}} users', {
            count: result.data?.reset_count ?? 0,
          })
        )
        triggerRefresh()
      } else {
        toast.error(result.message || t('Request failed'))
      }
    } catch (e: unknown) {
      handleServerError(e, t('Request failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Reset Quota Now')}
      desc={t(
        'This will immediately apply quota reset rules to all eligible users. This action cannot be undone.'
      )}
      destructive
      confirmText={t('Confirm')}
      handleConfirm={handleConfirm}
      isLoading={loading}
    />
  )
}
