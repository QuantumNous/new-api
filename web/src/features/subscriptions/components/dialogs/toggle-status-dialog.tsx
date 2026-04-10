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
  const title = isEnabled ? t('确认禁用') : t('确认启用')
  const description = isEnabled
    ? t('禁用后用户端不再展示，但历史订单不受影响。是否继续？')
    : t('启用后套餐将在用户端展示。是否继续？')

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await patchPlanStatus(currentRow.plan.id, !isEnabled)
      if (res.success) {
        toast.success(isEnabled ? t('已禁用') : t('已启用'))
        triggerRefresh()
        setOpen(null)
      }
    } catch {
      toast.error(t('操作失败'))
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
      confirmText={isEnabled ? t('禁用') : t('启用')}
      destructive={isEnabled}
    />
  )
}
