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
import { useMemo } from 'react'
import { PauseCircle, PlayCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { RecurringSubscription } from '../../types'

interface RecurringSubscriptionActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: 'cancel' | 'resume'
  subscription: RecurringSubscription | null
  planTitle?: string
  isLoading?: boolean
  onConfirm: () => void
}

export function RecurringSubscriptionActionDialog(
  props: RecurringSubscriptionActionDialogProps
) {
  const { t } = useTranslation()
  const periodEnd = props.subscription?.current_period_end || 0
  const periodEndText = useMemo(() => {
    if (!periodEnd) return '-'
    return new Date(periodEnd * 1000).toLocaleString()
  }, [periodEnd])
  const isCancel = props.action === 'cancel'
  const title = isCancel ? t('Cancel auto-renewal') : t('Resume auto-renewal')
  const description = isCancel
    ? t(
        'This subscription will remain active until {{date}} and will not renew after that.',
        { date: periodEndText }
      )
    : t('This subscription will renew automatically again after {{date}}.', {
        date: periodEndText,
      })

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      desc={description}
      confirmText={
        isCancel ? t('Cancel auto-renewal') : t('Resume auto-renewal')
      }
      destructive={isCancel}
      isLoading={props.isLoading}
      handleConfirm={props.onConfirm}
    >
      <div className='bg-muted/40 flex items-center gap-2 rounded-md border p-3 text-sm'>
        {isCancel ? (
          <PauseCircle className='text-muted-foreground h-4 w-4 shrink-0' />
        ) : (
          <PlayCircle className='text-muted-foreground h-4 w-4 shrink-0' />
        )}
        <span className='min-w-0 truncate'>
          {props.planTitle || t('Subscription')} #
          {props.subscription?.binding_id}
        </span>
      </div>
    </ConfirmDialog>
  )
}
