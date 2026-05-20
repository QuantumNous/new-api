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
import { patchPlanStatus } from '../../api'
import { useSubscriptions } from '../subscriptions-provider'

export function ToggleStatusDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [loading, setLoading] = useState(false)

  if (open !== 'toggle-status' || !currentRow) return null

  const isEnabled = currentRow.plan.enabled
  const title = isEnabled
    ? t('subs.toggle.confirm_disable_title')
    : t('subs.toggle.confirm_enable_title')
  const description = isEnabled
    ? t('subs.toggle.confirm_disable_desc')
    : t('subs.toggle.confirm_enable_desc')

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await patchPlanStatus(currentRow.plan.id, !isEnabled)
      if (res.success) {
        toast.success(
          isEnabled ? t('subs.toast.plan_disabled') : t('subs.toast.plan_enabled')
        )
        triggerRefresh()
        setOpen(null)
      } else {
        toast.error(t('subs.toast.plan_status_failed'))
      }
    } catch {
      toast.error(t('subs.toast.plan_status_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && setOpen(null)}
      title={title}
      desc={description}
      handleConfirm={handleConfirm}
      isLoading={loading}
      confirmText={isEnabled ? t('subs.row.disable_plan') : t('subs.row.enable_plan')}
      destructive={isEnabled}
    />
  )
}
