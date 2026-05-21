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
import { Check, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/status-badge'
import { useQuery } from '@tanstack/react-query'
import { getUserGroups } from '@/lib/api'
import { GroupBadge } from '@/components/group-badge'
import { formatKeyQuotaDisplay } from '../lib/format-key-quota'
import { type ApiKey } from '../types'
import {
  keysAccessKeyCellClassName,
  keysAccessKeyInnerClassName,
  keysGhostIconButtonClassName,
  keysGroupRatioBadgeClassName,
  keysPopoverPanelClassName,
  keysTableEmptyClass,
  keysTableMetaClass,
  keysTablePrimaryClass,
  keysTooltipContentClassName,
} from '../lib/keys-ui-styles'
import { useApiKeys } from './api-keys-provider'

function useGroupRatios(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['user-self-groups'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
    select: (res) => {
      if (!res.success || !res.data) return {}
      const ratios: Record<string, number> = {}
      for (const [group, info] of Object.entries(res.data)) {
        if (typeof info.ratio === 'number') {
          ratios[group] = info.ratio
        }
      }
      return ratios
    },
  })
  return data ?? {}
}

export function ApiKeyCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const {
    resolveRealKey,
    resolvedKeys,
    loadingKeys,
    copiedKeyId,
    markKeyCopied,
  } = useApiKeys()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const isLoading = !!loadingKeys[apiKey.id]
  const resolvedFullKey = resolvedKeys[apiKey.id]
  const isCopied = copiedKeyId === apiKey.id
  const maskedKey = `sk-${apiKey.key}`

  const handlePopoverOpen = useCallback(
    (open: boolean) => {
      setPopoverOpen(open)
      if (open && !resolvedFullKey) {
        resolveRealKey(apiKey.id)
      }
    },
    [resolvedFullKey, resolveRealKey, apiKey.id]
  )

  const handleCopy = useCallback(async () => {
    const realKey = resolvedFullKey || (await resolveRealKey(apiKey.id))
    if (realKey) {
      const ok = await copyToClipboard(realKey)
      if (ok) markKeyCopied(apiKey.id)
    }
  }, [resolvedFullKey, resolveRealKey, apiKey.id, markKeyCopied])

  return (
    <div className={keysAccessKeyCellClassName}>
      <div className={keysAccessKeyInnerClassName}>
        <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
          <PopoverTrigger
            render={
              <Button
                variant='ghost'
                size='sm'
                className={cn(
                  'h-7 max-w-[180px] truncate px-1.5 font-mono text-xs',
                  keysTableMetaClass,
                  keysGhostIconButtonClassName
                )}
              />
            }
          >
            {maskedKey}
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              'w-auto max-w-[min(90vw,28rem)]',
              keysPopoverPanelClassName
            )}
            align='start'
          >
            <div className='space-y-2'>
              <p className='text-xs text-slate-600'>{t('keys.cell.full_key')}</p>
              {isLoading ? (
                <div className='flex items-center gap-2 py-2'>
                  <Loader2 className='size-3.5 animate-spin text-slate-500' />
                  <span className='text-xs text-slate-600'>
                    {t('keys.cell.loading')}
                  </span>
                </div>
              ) : (
                <input
                  readOnly
                  value={resolvedFullKey || maskedKey}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  className='w-full min-w-[280px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 outline-none'
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div className='absolute start-full top-1/2 z-[1] ms-1 -translate-y-1/2'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className={cn('size-7 shrink-0', keysGhostIconButtonClassName)}
                  onClick={handleCopy}
                  disabled={isLoading}
                />
              }
            >
              {isLoading ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : isCopied ? (
                <Check className='size-3.5 text-emerald-500' />
              ) : (
                <Copy className='size-3.5' />
              )}
            </TooltipTrigger>
            <TooltipContent className={keysTooltipContentClassName}>
              {isLoading
                ? t('keys.cell.loading')
                : isCopied
                  ? t('keys.cell.copied')
                  : t('keys.cell.copy_key')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export function ModelLimitsCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()

  if (!apiKey.model_limits_enabled || !apiKey.model_limits) {
    return (
      <StatusBadge
        label={t('keys.models.unlimited')}
        variant='neutral'
        copyable={false}
      />
    )
  }

  const models = apiKey.model_limits.split(',').filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <StatusBadge
          label={t('keys.models.count', { count: models.length })}
          variant='neutral'
          copyable={false}
        />
      </TooltipTrigger>
      <TooltipContent
        side='top'
        className={cn('max-w-xs', keysTooltipContentClassName)}
      >
        <div className='max-h-[200px] space-y-0.5 overflow-y-auto text-xs'>
          {models.map((m) => (
            <div key={m} className='font-mono'>
              {m}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) return '[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

export function KeysQuotaCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()

  if (apiKey.unlimited_quota) {
    return (
      <div className='flex justify-center'>
        <StatusBadge
          label={t('keys.quota.unlimited')}
          variant='neutral'
          copyable={false}
        />
      </div>
    )
  }

  const used = apiKey.used_quota
  const remaining = apiKey.remain_quota
  const total = used + remaining
  const percentage = total > 0 ? (remaining / total) * 100 : 0

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className='mx-auto w-full max-w-[160px] space-y-0.5' />
        }
      >
        <div className='flex items-baseline justify-between gap-1.5 text-xs'>
          <span className={keysTableMetaClass}>{t('keys.quota.remaining_short')}</span>
          <span
            className={cn('shrink-0 font-semibold tabular-nums', keysTablePrimaryClass)}
          >
            {formatKeyQuotaDisplay(remaining)}
          </span>
        </div>
        <div className='flex items-baseline justify-between gap-1.5 text-xs'>
          <span className={keysTableMetaClass}>{t('keys.quota.used_short')}</span>
          <span className={cn('shrink-0 tabular-nums', keysTableMetaClass)}>
            {formatKeyQuotaDisplay(used)}
          </span>
        </div>
        <Progress
          value={percentage}
          className={cn('h-1.5', getQuotaProgressColor(percentage))}
        />
      </TooltipTrigger>
      <TooltipContent className={keysTooltipContentClassName}>
        <div className='space-y-1 text-xs'>
          <div>
            {t('keys.quota.remaining')}: {formatKeyQuotaDisplay(remaining)} (
            {percentage.toFixed(1)}%)
          </div>
          <div>
            {t('keys.quota.used')}: {formatKeyQuotaDisplay(used)}
          </div>
          <div>
            {t('keys.quota.total')}: {formatKeyQuotaDisplay(total)}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function KeysGroupCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const groupRatios = useGroupRatios()
  const group = apiKey.group?.trim() ?? ''
  const ratio = group && group !== 'auto' ? groupRatios[group] : undefined

  if (group === 'auto') {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span className='inline-flex max-w-[115px] items-center gap-1 text-xs' />}
        >
          <GroupBadge group='auto' />
          {apiKey.cross_group_retry && (
            <>
              <span className={keysTableEmptyClass}>·</span>
              <span className={keysTableMetaClass}>
                {t('keys.drawer.cross_group')}
              </span>
            </>
          )}
        </TooltipTrigger>
        <TooltipContent className={keysTooltipContentClassName}>
          <span className='text-xs'>{t('keys.drawer.auto_group_hint')}</span>
        </TooltipContent>
      </Tooltip>
    )
  }

  const ratioBadge =
    ratio != null ? (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={keysGroupRatioBadgeClassName}
              aria-label={t('keys.group.ratio_hint', { ratio })}
            />
          }
        >
          <span>{ratio}x</span>
        </TooltipTrigger>
        <TooltipContent className={keysTooltipContentClassName}>
          <span className='text-xs'>
            {t('keys.group.ratio_hint', { ratio })}
          </span>
        </TooltipContent>
      </Tooltip>
    ) : null

  return (
    <span className='inline-flex max-w-[115px] items-center gap-1'>
      <GroupBadge group={group} />
      {ratioBadge}
    </span>
  )
}

export function IpRestrictionsCell({ apiKey }: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const allowIps = apiKey.allow_ips?.trim()

  if (!allowIps) {
    return (
      <StatusBadge
        label={t('keys.cell.no_ip')}
        variant='neutral'
        copyable={false}
      />
    )
  }

  const ips = allowIps
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean)

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <StatusBadge
          label={t('keys.cell.ip_count', { count: ips.length })}
          variant='neutral'
          copyable={false}
        />
      </TooltipTrigger>
      <TooltipContent
        side='top'
        className={cn('max-w-xs', keysTooltipContentClassName)}
      >
        <div className='max-h-[200px] space-y-0.5 overflow-y-auto text-xs'>
          {ips.map((ip) => (
            <div key={ip} className='font-mono'>
              {ip}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
