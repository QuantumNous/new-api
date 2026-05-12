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
/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ListOrdered,
  Shuffle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyLabel } from '@/lib/currency'
import {
  formatTimestampToDate,
  formatQuota as formatQuotaValue,
} from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn, truncateText } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { GroupBadge } from '@/components/group-badge'
import {
  StatusBadge,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import { getCodexUsage } from '../api'
import { CHANNEL_STATUS_CONFIG, MODEL_FETCHABLE_TYPES } from '../constants'
import {
  formatBalance,
  formatRelativeTime,
  formatResponseTime,
  getBalanceVariant,
  getChannelTypeIcon,
  getChannelTypeLabel,
  getResponseTimeConfig,
  isMultiKeyChannel,
  parseModelsList,
  parseGroupsList,
  parseChannelSettings,
  handleUpdateChannelField,
  handleUpdateTagField,
  handleUpdateChannelBalance,
  isTagAggregateRow,
  type TagRow,
} from '../lib'
import { parseUpstreamUpdateMeta } from '../lib/upstream-update-utils'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'
import { DataTableRowActions } from './data-table-row-actions'
import { DataTableTagRowActions } from './data-table-tag-row-actions'
import {
  CodexUsageDialog,
  type CodexUsageDialogData,
} from './dialogs/codex-usage-dialog'
import { NumericSpinnerInput } from './numeric-spinner-input'

function parseIonetMeta(otherInfo: string | null | undefined): null | {
  source?: string
  deployment_id?: string
} {
  if (!otherInfo) return null
  try {
    const parsed = JSON.parse(otherInfo)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

/**
 * Render limited items with "and X more" indicator
 */
function renderLimitedItems(
  items: React.ReactNode[],
  maxDisplay: number = 2
): React.ReactNode {
  if (items.length === 0)
    return <span className='text-muted-foreground text-xs'>-</span>

  const displayed = items.slice(0, maxDisplay)
  const remaining = items.length - maxDisplay

  return (
    <div className='flex max-w-full items-center gap-1 overflow-hidden'>
      {displayed}
      {remaining > 0 && (
        <StatusBadge
          label={`+${remaining}`}
          variant='neutral'
          size='sm'
          copyable={false}
          className='flex-shrink-0'
        />
      )}
    </div>
  )
}

/**
 * Upstream update tags (+N / -N) shown on channel name for model-fetchable channels
 */
function UpstreamUpdateTags({ channel }: { channel: Channel }) {
  const { upstream, setCurrentRow } = useChannels()
  if (!MODEL_FETCHABLE_TYPES.has(channel.type)) return null

  const meta = parseUpstreamUpdateMeta(channel.settings)
  if (!meta.enabled) return null

  const addCount = meta.pendingAddModels.length
  const removeCount = meta.pendingRemoveModels.length
  if (addCount === 0 && removeCount === 0) return null

  return (
    <div className='flex items-center gap-0.5'>
      {addCount > 0 && (
        <StatusBadge
          label={`+${addCount}`}
          variant='success'
          size='sm'
          copyable={false}
          className='cursor-pointer'
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            setCurrentRow(channel)
            upstream.openModal(
              channel,
              meta.pendingAddModels,
              meta.pendingRemoveModels,
              'add'
            )
          }}
        />
      )}
      {removeCount > 0 && (
        <StatusBadge
          label={`-${removeCount}`}
          variant='danger'
          size='sm'
          copyable={false}
          className='cursor-pointer'
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            setCurrentRow(channel)
            upstream.openModal(
              channel,
              meta.pendingAddModels,
              meta.pendingRemoveModels,
              'remove'
            )
          }}
        />
      )}
    </div>
  )
}

/**
 * Priority cell component with inline editing
 */
function PriorityCell({ channel }: { channel: Channel }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isTagRow = isTagAggregateRow(channel)
  const priority = channel.priority
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValue, setPendingValue] = useState<number | null>(null)

  // Tag row - editable with confirmation for all tag channels
  if (isTagRow) {
    const tag = channel.tag || ''
    const channelCount = channel.children?.length || 0

    return (
      <>
        <NumericSpinnerInput
          value={priority ?? 0}
          onChange={(value) => {
            setPendingValue(value)
            setConfirmOpen(true)
          }}
          min={-999}
        />
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('Confirm Batch Update')}
          desc={`This will update the priority to ${pendingValue} for all ${channelCount} channel(s) with tag "${tag}". Continue?`}
          confirmText='Update'
          handleConfirm={() => {
            if (pendingValue !== null) {
              handleUpdateTagField(tag, 'priority', pendingValue, queryClient)
            }
            setConfirmOpen(false)
          }}
        />
      </>
    )
  }

  // Regular channel row - editable
  return (
    <NumericSpinnerInput
      value={priority ?? 0}
      onChange={(value) => {
        handleUpdateChannelField(channel.id, 'priority', value, queryClient)
      }}
      min={-999}
    />
  )
}

/**
 * Weight cell component with inline editing
 */
function WeightCell({ channel }: { channel: Channel }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isTagRow = isTagAggregateRow(channel)
  const weight = channel.weight
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValue, setPendingValue] = useState<number | null>(null)

  // Tag row - editable with confirmation for all tag channels
  if (isTagRow) {
    const tag = channel.tag || ''
    const channelCount = channel.children?.length || 0

    return (
      <>
        <NumericSpinnerInput
          value={weight ?? 0}
          onChange={(value) => {
            setPendingValue(value)
            setConfirmOpen(true)
          }}
          min={0}
        />
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('Confirm Batch Update')}
          desc={`This will update the weight to ${pendingValue} for all ${channelCount} channel(s) with tag "${tag}". Continue?`}
          confirmText='Update'
          handleConfirm={() => {
            if (pendingValue !== null) {
              handleUpdateTagField(tag, 'weight', pendingValue, queryClient)
            }
            setConfirmOpen(false)
          }}
        />
      </>
    )
  }

  // Regular channel row - editable
  return (
    <NumericSpinnerInput
      value={weight ?? 0}
      onChange={(value) => {
        handleUpdateChannelField(channel.id, 'weight', value, queryClient)
      }}
      min={0}
    />
  )
}

/**
 * Balance cell component with click to update
 */
function BalanceCell({ channel }: { channel: Channel }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isTagRow = isTagAggregateRow(channel)
  const balance = channel.balance || 0
  const usedQuota = channel.used_quota || 0
  const [isUpdating, setIsUpdating] = useState(false)
  const [codexUsageOpen, setCodexUsageOpen] = useState(false)
  const [codexUsageResponse, setCodexUsageResponse] =
    useState<CodexUsageDialogData | null>(null)
  const currencyLabel = getCurrencyLabel()
  const tokenSuffix = currencyLabel === 'Tokens' ? ' Tokens' : ''
  const withSuffix = (value: string) =>
    tokenSuffix && value !== '-' ? `${value}${tokenSuffix}` : value

  const usedDisplay = withSuffix(formatQuotaValue(usedQuota))
  const remainingDisplay = withSuffix(formatBalance(balance))

  // Tag row: only show cumulative used quota
  if (isTagRow) {
    return (
      <StatusBadge
        label={`Used: ${usedDisplay}`}
        variant='neutral'
        size='sm'
        copyable={false}
      />
    )
  }

  // Regular channel row: show used and remaining with click to update
  const variant = getBalanceVariant(balance)

  const handleClickUpdate = async () => {
    if (isUpdating) return

    setIsUpdating(true)
    if (channel.type === 57) {
      try {
        const res = await getCodexUsage(channel.id)
        if (!res.success) {
          throw new Error(res.message || t('Failed to fetch usage'))
        }
        setCodexUsageResponse(res)
        setCodexUsageOpen(true)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('Failed to fetch usage')
        )
      } finally {
        setIsUpdating(false)
      }
      return
    }

    await handleUpdateChannelBalance(channel.id, queryClient)
    setIsUpdating(false)
  }

  return (
    <TooltipProvider>
      <div className='flex items-center gap-1.5 text-xs font-medium'>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            dotColorMap[isUpdating ? 'neutral' : variant]
          )}
          aria-hidden='true'
        />
        <Tooltip>
          <TooltipTrigger
            render={<span className='text-muted-foreground cursor-help' />}
          >
            {usedDisplay}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {t('Used:')} {usedDisplay}
            </p>
          </TooltipContent>
        </Tooltip>
        <span className='text-muted-foreground/30'>·</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={cn(
                  'cursor-pointer transition-opacity hover:opacity-70',
                  channel.type === 57
                    ? 'text-primary'
                    : textColorMap[isUpdating ? 'neutral' : variant]
                )}
                onClick={handleClickUpdate}
              />
            }
          >
            {isUpdating
              ? 'Updating...'
              : channel.type === 57
                ? t('Account Info')
                : remainingDisplay}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {channel.type === 57
                ? t('Click to view Codex usage')
                : `${t('Remaining:')} ${remainingDisplay}`}
            </p>
            {channel.type !== 57 && <p>{t('Click to update balance')}</p>}
          </TooltipContent>
        </Tooltip>
      </div>

      <CodexUsageDialog
        open={codexUsageOpen}
        onOpenChange={setCodexUsageOpen}
        channelName={channel.name}
        channelId={channel.id}
        response={codexUsageResponse}
        onRefresh={async () => {
          if (isUpdating) return
          setIsUpdating(true)
          try {
            const res = await getCodexUsage(channel.id)
            if (!res.success) {
              throw new Error(res.message || t('Failed to fetch usage'))
            }
            setCodexUsageResponse(res)
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('Failed to fetch usage')
            )
          } finally {
            setIsUpdating(false)
          }
        }}
        isRefreshing={isUpdating}
      />
    </TooltipProvider>
  )
}

/**
 * Generate channels columns configuration
 */
export function useChannelsColumns(): ColumnDef<Channel>[] {
  const { t } = useTranslation()
  return [
    // Checkbox column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => {
        const isTagRow = isTagAggregateRow(row.original)

        // Don't show checkbox for tag rows
        if (isTagRow) {
          return null
        }

        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='Select row'
          />
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // ID column
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='ID' />
      ),
      cell: ({ row }) => {
        const id = row.getValue('id') as number
        return (
          <StatusBadge
            label={String(id)}
            variant='neutral'
            copyText={String(id)}
            size='sm'
            className='font-mono'
          />
        )
      },
      size: 80,
    },

    // Name column
    {
      accessorKey: 'name',
      meta: { label: t('Name'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ row }) => {
        const isTagRow = isTagAggregateRow(row.original)
        const name = row.getValue('name') as string
        const channel = row.original
        const isMultiKey = isMultiKeyChannel(channel)

        // Tag row with expand/collapse
        if (isTagRow) {
          const tag = (row.original as TagRow).tag || name
          const childrenCount = (row.original as TagRow).children?.length || 0

          return (
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
                onClick={row.getToggleExpandedHandler()}
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
              </Button>
              <div className='flex items-center gap-1.5'>
                <span className='font-semibold'>Tag：{tag}</span>
                <StatusBadge
                  label={`${childrenCount} channels`}
                  variant='blue'
                  size='sm'
                  copyable={false}
                />
              </div>
            </div>
          )
        }

        // Regular channel row
        const settings = parseChannelSettings(channel.setting)
        const isPassThrough = settings.pass_through_body_enabled === true

        return (
          <div className='flex items-center gap-2'>
            <div className='flex flex-col gap-1'>
              <div className='flex items-center gap-1.5'>
                <span className='font-medium'>{truncateText(name, 30)}</span>
                {isPassThrough && (
                  <TooltipProvider delay={100}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <AlertTriangle className='h-3.5 w-3.5 flex-shrink-0 text-amber-500' />
                        }
                      ></TooltipTrigger>
                      <TooltipContent side='top'>
                        {t(
                          'Request body pass-through is enabled. The request body will be sent directly to the upstream without any conversion.'
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isMultiKey && (
                  <StatusBadge
                    label={`${channel.channel_info.multi_key_size} keys`}
                    variant='purple'
                    size='sm'
                    copyable={false}
                  />
                )}
                <UpstreamUpdateTags channel={channel} />
              </div>
              {channel.remark && (
                <TooltipProvider delay={200}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className='text-muted-foreground text-xs' />
                      }
                    >
                      {truncateText(channel.remark, 40)}
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='max-w-xs'>
                      {channel.remark}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        )
      },
      minSize: 200,
    },

    // Type column
    {
      accessorKey: 'type',
      meta: { label: t('Type') },
      header: t('Type'),
      cell: ({ row }) => {
        const isTagRow = isTagAggregateRow(row.original)

        if (isTagRow) {
          return (
            <StatusBadge
              label={t('Tag Aggregate')}
              variant='blue'
              size='sm'
              copyable={false}
            />
          )
        }

        const type = row.getValue('type') as number
        const typeNameKey = getChannelTypeLabel(type)
        const typeName = t(typeNameKey)
        const iconName = getChannelTypeIcon(type)
        const icon = getLobeIcon(`${iconName}.Color`, 20)
        const channel = row.original as Channel
        const isMultiKey = isMultiKeyChannel(channel)
        const multiKeyMode = channel.channel_info?.multi_key_mode ?? 'random'
        const MultiKeyModeIcon =
          multiKeyMode === 'random' ? Shuffle : ListOrdered
        const multiKeyTooltip =
          multiKeyMode === 'random'
            ? t('Multi-key: Random rotation')
            : t('Multi-key: Polling rotation')

        const ionetMeta = parseIonetMeta(channel.other_info)
        const isIonet = ionetMeta?.source === 'ionet'
        const deploymentId =
          typeof ionetMeta?.deployment_id === 'string'
            ? ionetMeta?.deployment_id
            : undefined

        return (
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1.5'>
              {isMultiKey && (
                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className='border-border bg-muted text-primary inline-flex h-6 w-6 items-center justify-center rounded-md border' />
                      }
                    >
                      <MultiKeyModeIcon className='h-3.5 w-3.5' />
                    </TooltipTrigger>
                    <TooltipContent side='top'>
                      {multiKeyTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {icon}
            </div>
            <StatusBadge
              label={typeName}
              autoColor={typeName}
              size='sm'
              copyable={false}
            />
            {isIonet && (
              <TooltipProvider delay={100}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className='flex cursor-pointer items-center gap-1.5 text-xs font-medium'
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!deploymentId) return
                          const targetUrl = `/console/deployment?deployment_id=${deploymentId}`
                          window.open(targetUrl, '_blank', 'noopener')
                        }}
                      />
                    }
                  >
                    <span className='text-muted-foreground/30'>·</span>
                    <span className={cn(textColorMap.purple)}>IO.NET</span>
                  </TooltipTrigger>
                  <TooltipContent side='top'>
                    <div className='max-w-xs space-y-1'>
                      <div className='text-xs'>
                        {t('From IO.NET deployment')}
                      </div>
                      {deploymentId && (
                        <div className='text-muted-foreground font-mono text-xs'>
                          {t('Deployment ID')}: {deploymentId}
                        </div>
                      )}
                      <div className='text-muted-foreground text-xs'>
                        {t('Click to open deployment')}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        return value.includes(String(row.getValue(id)))
      },
      size: 140,
      enableSorting: false,
    },

    // Status column
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: t('Status'),
      cell: ({ row }) => {
        const isTagRow = isTagAggregateRow(row.original)
        const status = row.getValue('status') as number
        const channel = row.original as Channel

        // Tag row: show aggregated status
        if (isTagRow) {
          const childrenCount = (row.original as TagRow).children?.length || 0
          const hasEnabled = status === 1

          if (hasEnabled) {
            return (
              <StatusBadge
                label={`Active (${childrenCount})`}
                variant='success'
                showDot
                size='sm'
                copyable={false}
              />
            )
          } else {
            return (
              <StatusBadge
                label={`Inactive (${childrenCount})`}
                variant='neutral'
                size='sm'
                copyable={false}
              />
            )
          }
        }

        // Regular channel row
        const config =
          CHANNEL_STATUS_CONFIG[status as keyof typeof CHANNEL_STATUS_CONFIG] ||
          CHANNEL_STATUS_CONFIG[0]

        const isMultiKey = isMultiKeyChannel(channel)
        const keySize = channel.channel_info?.multi_key_size ?? 0
        const disabledCount = channel.channel_info?.multi_key_status_list
          ? Object.keys(channel.channel_info.multi_key_status_list).length
          : 0
        const enabledCount = Math.max(0, keySize - disabledCount)
        const label =
          isMultiKey && keySize > 0
            ? `${t(config.label)} (${enabledCount}/${keySize})`
            : t(config.label)

        // Auto-disabled: show reason and time tooltip
        if (status === 3) {
          let statusReason = ''
          let statusTime = ''
          try {
            const otherInfo = channel.other_info
              ? JSON.parse(channel.other_info)
              : null
            if (otherInfo) {
              statusReason = otherInfo.status_reason || ''
              statusTime = otherInfo.status_time
                ? formatTimestampToDate(otherInfo.status_time)
                : ''
            }
          } catch {
            /* empty */
          }

          if (statusReason || statusTime) {
            return (
              <TooltipProvider delay={100}>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <StatusBadge
                      label={label}
                      variant={config.variant}
                      showDot={config.showDot}
                      size='sm'
                      copyable={false}
                    />
                  </TooltipTrigger>
                  <TooltipContent side='top' className='max-w-xs'>
                    <div className='space-y-1 text-xs'>
                      {statusReason && (
                        <div>
                          {t('Reason:')} {statusReason}
                        </div>
                      )}
                      {statusTime && (
                        <div>
                          {t('Time:')} {statusTime}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
        }

        return (
          <StatusBadge
            label={label}
            variant={config.variant}
            showDot={config.showDot}
            size='sm'
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        const status = row.getValue(id) as number
        if (value.includes('enabled')) return status === 1
        if (value.includes('disabled')) return status !== 1
        return false
      },
      size: 120,
      enableSorting: false,
    },

    // Models column
    {
      accessorKey: 'models',
      meta: { label: t('Models'), mobileHidden: true },
      header: t('Models'),
      cell: ({ row }) => {
        const models = row.getValue('models') as string
        const modelArray = parseModelsList(models)

        if (modelArray.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const modelBadges = modelArray.map((model, idx) => (
          <StatusBadge
            key={idx}
            label={model}
            autoColor={model}
            size='sm'
            className='font-mono'
          />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<div />}>
                {renderLimitedItems(modelBadges, 2)}
              </TooltipTrigger>
              {modelArray.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{modelBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 200,
      enableSorting: false,
    },

    // Group column
    {
      accessorKey: 'group',
      meta: { label: t('Groups'), mobileHidden: true },
      header: t('Groups'),
      cell: ({ row }) => {
        const group = row.getValue('group') as string
        const groupArray = parseGroupsList(group)

        const groupBadges = groupArray.map((g) => (
          <GroupBadge key={g} group={g} size='sm' />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<div />}>
                {renderLimitedItems(groupBadges, 2)}
              </TooltipTrigger>
              {groupArray.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
                >
                  <div className='flex flex-wrap gap-1'>{groupBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0 || value.includes('all')) return true
        const group = row.getValue(id) as string
        const groupArray = parseGroupsList(group)
        return groupArray.some((g) => value.includes(g))
      },
      size: 150,
      enableSorting: false,
    },

    // Tag column
    {
      accessorKey: 'tag',
      meta: { label: t('Tag'), mobileHidden: true },
      header: t('Tag'),
      cell: ({ row }) => {
        const tag = row.getValue('tag') as string | null
        if (!tag)
          return <span className='text-muted-foreground text-xs'>-</span>

        return <StatusBadge label={tag} autoColor={tag} size='sm' />
      },
      size: 120,
      enableSorting: false,
    },

    // Priority column
    {
      accessorKey: 'priority',
      meta: { label: t('Priority'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Priority')} />
      ),
      cell: ({ row }) => <PriorityCell channel={row.original} />,
      size: 100,
    },

    // Weight column
    {
      accessorKey: 'weight',
      meta: { label: t('Weight'), mobileHidden: true },
      header: t('Weight'),
      cell: ({ row }) => <WeightCell channel={row.original} />,
      size: 90,
      enableSorting: false,
    },

    // Balance column (Used/Remaining)
    {
      accessorKey: 'balance',
      meta: { label: t('Used / Remaining') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Used / Remaining')} />
      ),
      cell: ({ row }) => <BalanceCell channel={row.original} />,
      size: 180,
    },

    // Response Time column
    {
      accessorKey: 'response_time',
      meta: { label: t('Response'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Response')} />
      ),
      cell: ({ row }) => {
        const responseTime = row.getValue('response_time') as number
        const config = getResponseTimeConfig(responseTime)

        return (
          <StatusBadge
            label={formatResponseTime(responseTime, t)}
            variant={config.variant}
            size='sm'
            copyable={false}
          />
        )
      },
      size: 110,
    },

    // Test Time column
    {
      accessorKey: 'test_time',
      meta: { label: t('Last Tested'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Last Tested')} />
      ),
      cell: ({ row }) => {
        const testTime = row.getValue('test_time') as number

        // For invalid timestamps, show "Never" badge
        if (!testTime || testTime === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const timeText = formatRelativeTime(testTime)
        const fullDate = formatTimestampToDate(testTime)

        // For valid timestamps, show tooltip with full date
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className='text-muted-foreground cursor-pointer font-mono text-sm' />
                }
              >
                {timeText}
              </TooltipTrigger>
              <TooltipContent side='top'>
                <p className='font-mono text-sm'>{fullDate}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 120,
      enableSorting: false,
    },

    // Actions column
    {
      id: 'actions',
      cell: ({ row }) => {
        // Check if this is a tag row (has children)
        const isTagRow = isTagAggregateRow(row.original)

        if (isTagRow) {
          return (
            <DataTableTagRowActions
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              row={row as any}
            />
          )
        }

        return <DataTableRowActions row={row} />
      },
      size: 132,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
