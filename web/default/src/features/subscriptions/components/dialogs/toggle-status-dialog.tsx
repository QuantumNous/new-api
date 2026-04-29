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
  const title = isEnabled ? t('Confirm disable') : t('Confirm enable')
  const description = isEnabled
    ? t(
        'After disabling, it will no longer be shown to users, but historical orders are not affected. Continue?'
      )
    : t('After enabling, the plan will be shown to users. Continue?')

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await patchPlanStatus(currentRow.plan.id, !isEnabled)
      if (res.success) {
        toast.success(
          isEnabled ? t('Has been disabled') : t('Has been enabled')
        )
        triggerRefresh()
        setOpen(null)
      }
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
      title={title}
      desc={description}
      handleConfirm={handleConfirm}
      isLoading={loading}
      confirmText={isEnabled ? t('Disable') : t('Enable')}
      destructive={isEnabled}
    />
  )
}
