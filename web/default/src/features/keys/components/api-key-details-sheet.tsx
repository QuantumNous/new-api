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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getUserGroups } from '@/lib/api'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { API_KEY_STATUSES } from '../constants'
import type { ApiKey } from '../types'
import {
  ApiKeyCell,
  IpRestrictionsCell,
  ModelLimitsCell,
} from './api-keys-cells'

function DetailRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='border-border grid grid-cols-[7.5rem_1fr] gap-3 border-b py-2.5 last:border-b-0'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </div>
      <div className='min-w-0 text-sm'>{props.children}</div>
    </div>
  )
}

export function ApiKeyDetailsSheet(props: {
  apiKey: ApiKey | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const apiKey = props.apiKey
  const { data: groupRatios = {} } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 60_000,
    select: (res) => {
      if (!res.success || !res.data) return {} as Record<string, number>
      const ratios: Record<string, number> = {}
      for (const [group, info] of Object.entries(res.data)) {
        if (typeof info.ratio === 'number') ratios[group] = info.ratio
      }
      return ratios
    },
  })

  if (!apiKey) return null

  const statusConfig = API_KEY_STATUSES[apiKey.status]
  const group = apiKey.group
  const ratio = group && group !== 'auto' ? groupRatios[group] : undefined
  const total = apiKey.used_quota + apiKey.remain_quota

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle className='truncate'>{apiKey.name}</SheetTitle>
          <SheetDescription>
            {t('Full key metadata and restrictions')}
          </SheetDescription>
        </SheetHeader>

        <div className='mt-4 px-1'>
          <DetailRow label={t('Status')}>
            {statusConfig ? (
              <StatusBadge
                label={t(statusConfig.label)}
                variant={statusConfig.variant}
                copyable={false}
              />
            ) : (
              '—'
            )}
          </DetailRow>

          <DetailRow label={t('Key')}>
            <ApiKeyCell apiKey={apiKey} />
          </DetailRow>

          <DetailRow label={t('Quota')}>
            {apiKey.unlimited_quota ? (
              <span>{t('Follow user')}</span>
            ) : (
              <span className='font-mono text-xs tabular-nums'>
                {formatQuota(apiKey.remain_quota)}
                <span className='text-muted-foreground'>
                  {' / '}
                  {formatQuota(total)}
                </span>
                <span className='text-muted-foreground ml-2'>
                  ({t('Used:')} {formatQuota(apiKey.used_quota)})
                </span>
              </span>
            )}
          </DetailRow>

          <DetailRow label={t('Channel group')}>
            {group === 'auto' ? (
              <GroupBadge group='auto' />
            ) : (
              <GroupBadge group={group} ratio={ratio} />
            )}
          </DetailRow>

          <DetailRow label={t('Models')}>
            <ModelLimitsCell apiKey={apiKey} />
          </DetailRow>

          <DetailRow label={t('IP Restriction')}>
            <IpRestrictionsCell apiKey={apiKey} />
          </DetailRow>

          <DetailRow label={t('Created')}>
            <span className='text-muted-foreground text-xs'>
              {apiKey.created_time
                ? formatTimestampToDate(apiKey.created_time)
                : '—'}
            </span>
          </DetailRow>

          <DetailRow label={t('Last Used')}>
            <span className='text-muted-foreground text-xs'>
              {apiKey.accessed_time
                ? formatTimestampToDate(apiKey.accessed_time)
                : '—'}
            </span>
          </DetailRow>

          <DetailRow label={t('Expires')}>
            {apiKey.expired_time === -1 ? (
              <StatusBadge
                label={t('Never')}
                variant='neutral'
                copyable={false}
              />
            ) : (
              <span className='text-muted-foreground text-xs'>
                {formatTimestampToDate(apiKey.expired_time)}
              </span>
            )}
          </DetailRow>
        </div>
      </SheetContent>
    </Sheet>
  )
}
