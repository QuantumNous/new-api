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
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Switch } from '@/components/ui/switch'

import { syncPlanSubscriptions } from '../../api'
import type { SyncPlanSubscriptionsRequest } from '../../types'
import { useSubscriptions } from '../subscriptions-provider'

const defaultSyncOptions: SyncPlanSubscriptionsRequest = {
  sync_quota: true,
  sync_reset_period: true,
  sync_wallet_overflow: true,
  sync_groups: true,
}

type SyncOptionRowProps = {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SyncOptionRow(props: SyncOptionRowProps): React.JSX.Element {
  return (
    <label className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'>
      <span>{props.label}</span>
      <Switch
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        aria-label={props.label}
      />
    </label>
  )
}

type SyncMutationVariables = {
  planId: number
  options: SyncPlanSubscriptionsRequest
}

export function SyncSubscriptionsDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [options, setOptions] = useState<SyncPlanSubscriptionsRequest>({
    ...defaultSyncOptions,
  })
  const isOpen = open === 'sync-subscriptions'
  const plan = currentRow?.plan
  const planLabel = plan?.title || (plan?.id ? `#${plan.id}` : '-')
  const hasSelection =
    options.sync_quota ||
    options.sync_reset_period ||
    options.sync_wallet_overflow ||
    options.sync_groups

  const syncMutation = useMutation({
    mutationFn: (variables: SyncMutationVariables) =>
      syncPlanSubscriptions(variables.planId, variables.options),
    onSuccess: (res): void => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      const result = res.data
      toast.success(
        t('Synced {{count}} active subscriptions', {
          count: result?.updated_count || 0,
        })
      )
      if (result?.exhausted_count) {
        toast.warning(
          t(
            '{{count}} subscriptions have no remaining quota after synchronization',
            { count: result.exhausted_count }
          )
        )
      }
      if (result?.group_conflict_user_count) {
        toast.warning(
          t(
            'Group changes were skipped for {{count}} users because their current group could not be safely synchronized',
            { count: result.group_conflict_user_count }
          )
        )
      }
      triggerRefresh()
      setOpen(null)
    },
  })

  useEffect((): void => {
    if (isOpen) setOptions({ ...defaultSyncOptions })
  }, [isOpen])

  const handleConfirm = (): void => {
    if (!plan?.id || !hasSelection) return
    syncMutation.mutate({ planId: plan.id, options })
  }

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(nextOpen: boolean): void => {
        if (!nextOpen) setOpen(null)
      }}
      title={t('Sync subscription settings')}
      desc={t(
        'Sync active subscriptions under {{plan}} with the selected plan settings?',
        { plan: planLabel }
      )}
      confirmText={t('Sync settings')}
      handleConfirm={handleConfirm}
      disabled={!plan?.id || !hasSelection}
      isLoading={syncMutation.isPending}
    >
      <div className='space-y-2'>
        <SyncOptionRow
          label={t('Sync total quota')}
          checked={options.sync_quota}
          onCheckedChange={(checked: boolean): void =>
            setOptions((current) => ({ ...current, sync_quota: checked }))
          }
        />
        <SyncOptionRow
          label={t('Sync quota reset schedule')}
          checked={options.sync_reset_period}
          onCheckedChange={(checked: boolean): void =>
            setOptions((current) => ({
              ...current,
              sync_reset_period: checked,
            }))
          }
        />
        <SyncOptionRow
          label={t('Sync wallet fallback policy')}
          checked={options.sync_wallet_overflow}
          onCheckedChange={(checked: boolean): void =>
            setOptions((current) => ({
              ...current,
              sync_wallet_overflow: checked,
            }))
          }
        />
        <SyncOptionRow
          label={t('Sync upgrade and downgrade groups')}
          checked={options.sync_groups}
          onCheckedChange={(checked: boolean): void =>
            setOptions((current) => ({ ...current, sync_groups: checked }))
          }
        />
        {options.sync_groups && (
          <p className='text-muted-foreground px-1 text-xs'>
            {t(
              'Upgrade group changes take effect immediately. Downgrade groups take effect when subscriptions end, or immediately when an upgrade group is removed. Group sync is skipped when another subscription or a manual group change is detected.'
            )}
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}
