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
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'

import {
  resetPlanSubscriptions,
  restorePlanSubscriptionWindows,
} from '../../api'
import type { RestorePlanWindowsRequest } from '../../types'
import { useSubscriptions } from '../subscriptions-provider'

export function ResetSubscriptionsDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [advanceResetTime, setAdvanceResetTime] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [reason, setReason] = useState('')
  const [restoreRequest, setRestoreRequest] =
    useState<RestorePlanWindowsRequest | null>(null)
  const isWindowReset = open === 'restore-plan-windows'
  const isOpen = open === 'reset-subscriptions' || isWindowReset
  const plan = currentRow?.plan
  const planLabel = plan?.title || (plan?.id ? `#${plan.id}` : '-')

  const handleConfirm = async () => {
    if (!plan?.id || resetting || (isWindowReset && !reason.trim())) return
    setResetting(true)
    try {
      let request = restoreRequest
      if (isWindowReset && !request) {
        request = { idempotency_key: nanoid(), reason: reason.trim() }
        setRestoreRequest(request)
      }
      const res =
        isWindowReset && request
          ? await restorePlanSubscriptionWindows(plan.id, request)
          : await resetPlanSubscriptions(plan.id, {
              advance_reset_time: advanceResetTime,
            })
      if (res.success) {
        toast.success(
          t('Reset {{count}} active subscriptions', {
            count: res.data?.reset_count || 0,
          })
        )
        triggerRefresh()
        setOpen(null)
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(nextOpen) => !nextOpen && !resetting && setOpen(null)}
      title={
        isWindowReset ? t('Reset window quota') : t('Reset subscription quota')
      }
      desc={
        isWindowReset
          ? t(
              'Restore up to one window quota for each active subscription under {{plan}}? Subscriptions without a quota window are skipped. Reset times stay unchanged.',
              { plan: planLabel }
            )
          : t('Reset all active subscriptions under {{plan}}?', {
              plan: planLabel,
            })
      }
      confirmText={isWindowReset ? t('Restore window') : t('Reset quota')}
      handleConfirm={handleConfirm}
      disabled={!plan?.id || (isWindowReset && !reason.trim())}
      isLoading={resetting}
    >
      {isWindowReset ? (
        <>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Restore up to one window quota and clear current window usage. Total quota, history, in-flight requests, and subscription dates stay unchanged.'
            )}
          </p>
          <label className='grid gap-2 text-sm'>
            <span>{t('Reason')}</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              readOnly={!!restoreRequest}
              placeholder={t('Enter reason for this operation')}
              aria-label={t('Reason')}
              maxLength={2000}
              rows={3}
            />
          </label>
        </>
      ) : (
        <label className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'>
          <span>{t('Advance next reset time')}</span>
          <Switch
            checked={advanceResetTime}
            onCheckedChange={(checked) => setAdvanceResetTime(!!checked)}
            aria-label={t('Advance next reset time')}
          />
        </label>
      )}
    </ConfirmDialog>
  )
}
