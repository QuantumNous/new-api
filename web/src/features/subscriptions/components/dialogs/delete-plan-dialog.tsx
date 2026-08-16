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

import { deletePlan } from '../../api'
import { useSubscriptions } from '../subscriptions-provider'

export function DeletePlanDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [loading, setLoading] = useState(false)

  if (open !== 'delete' || !currentRow) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await deletePlan(currentRow.plan.id)
      if (res.success) {
        toast.success(t('Has been deleted'))
        triggerRefresh()
        setOpen(null)
        return
      }
      toast.error(res.message || t('Operation failed'))
    } catch {
      toast.error(t('Operation failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && setOpen(null)}
      title={t('Confirm delete')}
      desc={t(
        'The plan "{{title}}" will be deleted permanently. Plans that still have user subscriptions cannot be deleted. Continue?',
        { title: currentRow.plan.title }
      )}
      handleConfirm={handleConfirm}
      isLoading={loading}
      confirmText={t('Delete')}
      destructive
    />
  )
}
