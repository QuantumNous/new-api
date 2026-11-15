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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table'
import { Eye, MoreHorizontal, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { getChannelTypeLabel } from '@/features/channels/lib'
import { MODEL_PRICING_ISSUES_QUERY_KEY } from '@/features/system-settings/models/pricing-issues'
import { handleServerError } from '@/lib/handle-server-error'
import { resolveLocalizedText } from '@/lib/localized-text'

import {
  deleteTaskPluginVersion,
  listMarketplaceSources,
  listTaskPlugins,
  setTaskPluginStatus,
  TaskPluginUsageError,
} from '../api'
import {
  COMMUNITY_MARKETPLACE_INDEX_URL,
  fetchMarketplaceIndex,
  findRevokedEntry,
  isStaleFactoryOverride,
  marketplaceSourceKind,
} from '../lib/marketplace'
import { toastPluginChange } from '../lib/plugin-change-toast'
import {
  countPluginKinds,
  defaultPluginKind,
  type PluginKind,
} from '../lib/plugin-kinds'
import { localizedPluginName } from '../lib/plugin-name'
import { resolvePluginParts } from '../lib/plugin-parts'
import type { TaskPluginListItem, TaskPluginUsage } from '../types'
import { PluginCard } from './plugin-card'
import { PluginIcon } from './plugin-icon'
import { PluginKindSwitch } from './plugin-kind-switch'
import { PluginPartsBadges } from './plugin-parts-badges'
import { PluginWebsiteLink } from './plugin-website-link'
import { RevokedPluginWarning } from './revoked-plugin-warning'

const VIEW_MODE_STORAGE_KEY = 'task-plugins-view-mode'

type PluginsTableProps = {
  /** The kind the page URL names; without one the default kind is shown. */
  kind?: PluginKind
  onKindChange: (kind: PluginKind) => void
  onDetails: (plugin: TaskPluginListItem) => void
  onUpload: (key: string) => void
}

export function PluginsTable(props: PluginsTableProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<TaskPluginListItem | null>(
    null
  )
  const [blockedUsage, setBlockedUsage] = useState<TaskPluginUsage | null>(null)
  const [blockedAction, setBlockedAction] = useState<
    'delete' | 'disable' | null
  >(null)
  const [statusTarget, setStatusTarget] = useState<TaskPluginListItem | null>(
    null
  )
  const [statusConfirmation, setStatusConfirmation] = useState<{
    plugin: TaskPluginListItem
    enabled: boolean
  } | null>(null)
  const pluginsQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  // Installed code is checked against the community takedown list only when
  // the community source is in use and something was uploaded.
  const hasUploaded = (pluginsQuery.data ?? []).some(
    (plugin) => plugin.source !== 'factory' && plugin.source_hash
  )
  const sourcesQuery = useQuery({
    queryKey: ['task-plugin-marketplace-sources'],
    queryFn: listMarketplaceSources,
    enabled: hasUploaded,
  })
  const communityConfigured = (sourcesQuery.data ?? []).some(
    (source) => marketplaceSourceKind(source.index_url) === 'community'
  )
  const communityQuery = useQuery({
    queryKey: ['task-plugin-marketplace', COMMUNITY_MARKETPLACE_INDEX_URL],
    queryFn: () => fetchMarketplaceIndex(COMMUNITY_MARKETPLACE_INDEX_URL),
    enabled: hasUploaded && communityConfigured,
    retry: false,
    meta: { errorToast: false },
  })
  const communityIndex = communityQuery.data
  const statusMutation = useMutation({
    mutationFn: ({
      key,
      enabled,
      options,
    }: {
      key: string
      enabled: boolean
      options?: { cascade?: boolean; force?: boolean }
    }) => setTaskPluginStatus(key, enabled, options),
    onSuccess: (notice, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      queryClient.invalidateQueries({
        queryKey: MODEL_PRICING_ISSUES_QUERY_KEY,
      })
      if (variables.enabled && notice?.pricing_issues?.length) {
        toastPluginChange(t('Plugin enabled'), notice.pricing_issues)
      }
      setStatusConfirmation(null)
      setStatusTarget(null)
      setBlockedAction(null)
      setBlockedUsage(null)
    },
    onError: (error) => {
      if (error instanceof TaskPluginUsageError) {
        setStatusConfirmation(null)
        setBlockedUsage(error.usage)
        setBlockedAction('disable')
        return
      }
      handleServerError(error)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: ({
      plugin,
      force,
    }: {
      plugin: TaskPluginListItem
      force?: boolean
    }) => deleteTaskPluginVersion(plugin.meta.key, plugin.meta.version, force),
    onSuccess: (notice) => {
      setDeleteTarget(null)
      setBlockedAction(null)
      setBlockedUsage(null)
      toastPluginChange(t('Plugin version deleted'), notice?.pricing_issues)
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      queryClient.invalidateQueries({
        queryKey: MODEL_PRICING_ISSUES_QUERY_KEY,
      })
    },
    onError: (error) => {
      if (error instanceof TaskPluginUsageError) {
        setBlockedUsage(error.usage)
        setBlockedAction('delete')
        return
      }
      handleServerError(error)
    },
  })
  const columns = useMemo<ColumnDef<TaskPluginListItem, unknown>[]>(
    () => [
      {
        id: 'plugin',
        accessorFn: (row) =>
          `${localizedPluginName(row.meta, i18n.language)} ${row.meta.name} ${row.meta.key}`,
        header: t('Plugin'),
        cell: ({ row }) => {
          const description = resolveLocalizedText(
            row.original.meta.description,
            i18n.language
          )
          return (
            <div
              className='flex min-w-0 items-center gap-2'
              title={description || undefined}
            >
              <span className='shrink-0'>
                <PluginIcon
                  plugin={{
                    ...row.original.meta,
                    hasIcon: row.original.has_icon,
                  }}
                  size={18}
                />
              </span>
              <div className='min-w-0'>
                <div className='truncate text-sm font-medium'>
                  {localizedPluginName(row.original.meta, i18n.language)}
                </div>
                <div className='text-muted-foreground truncate font-mono text-xs'>
                  {row.original.meta.key}
                </div>
                <PluginWebsiteLink website={row.original.meta.website} />
                <RevokedPluginWarning
                  entry={findRevokedEntry(
                    communityIndex,
                    row.original.source_hash
                  )}
                />
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'meta.version',
        header: t('Active version'),
        cell: ({ row }) => (
          <span className='font-mono text-xs'>{row.original.meta.version}</span>
        ),
      },
      {
        id: 'source',
        header: t('Source'),
        cell: ({ row }) => {
          if (row.original.source === 'factory') {
            return <Badge variant='secondary'>{t('Built-in')}</Badge>
          }
          if (row.original.source === 'override_over_factory') {
            const factoryVersion = row.original.factory_meta?.version
            const staleHint = isStaleFactoryOverride(row.original)
              ? t(
                  'Built-in is v{{factory}}; delete the custom version to return to it',
                  { factory: factoryVersion }
                )
              : undefined
            return (
              <div className='flex min-w-0 flex-col gap-0.5' title={staleHint}>
                <Badge>
                  {t('Custom (replaces built-in {{version}})', {
                    version: factoryVersion,
                  })}
                </Badge>
                {staleHint ? (
                  <span className='text-muted-foreground text-xs'>
                    {staleHint}
                  </span>
                ) : null}
              </div>
            )
          }
          return <Badge>{t('Third-party')}</Badge>
        },
      },
      {
        id: 'channelType',
        header: t('Channel type'),
        cell: ({ row }) => {
          const parts = resolvePluginParts(row.original)
          const channelTypes = row.original.meta.channelTypes ?? []
          // A plugin that only processes requests is never a channel type.
          let channelType = null
          if (channelTypes.length > 0) {
            channelType = (
              <span className='text-xs'>
                {t(getChannelTypeLabel(channelTypes[0]))}
                <span className='text-muted-foreground ml-1'>
                  {channelTypes.map((type) => `#${type}`).join(' ')}
                </span>
              </span>
            )
          } else if (parts.task || parts.provider) {
            channelType = (
              <span className='text-xs'>
                {parts.provider ? t('Plugin') : t('Task Plugin')}
              </span>
            )
          }
          return (
            <div className='flex flex-wrap items-center gap-1.5'>
              {channelType}
              <PluginPartsBadges transform={parts.transform} />
            </div>
          )
        },
      },
      {
        id: 'models',
        header: t('Models'),
        cell: ({ row }) => row.original.meta.models?.length ?? 0,
      },
      {
        id: 'enabled',
        header: t('Enabled'),
        cell: ({ row }) => (
          <Switch
            aria-label={t('Enable plugin {{key}}', {
              key: row.original.meta.key,
            })}
            checked={row.original.enabled}
            disabled={statusMutation.isPending}
            onCheckedChange={(checked) => {
              setStatusConfirmation({
                plugin: row.original,
                enabled: checked,
              })
            }}
          />
        ),
      },
      {
        id: 'runtime',
        header: t('Runtime status'),
        cell: ({ row }) => {
          const status = row.original.runtime_status
          if (status === 'registered') {
            return <Badge variant='outline'>{t('Registered')}</Badge>
          }
          if (status === 'compile_failed') {
            return (
              <Badge variant='destructive' title={row.original.runtime_error}>
                {t('Compilation failed')}
              </Badge>
            )
          }
          if (status === 'disabled') {
            return <Badge variant='secondary'>{t('Disabled')}</Badge>
          }
          if (status === 'disabled_fallback') {
            return (
              <Badge variant='secondary'>
                {row.original.factory_meta
                  ? t('Disabled; using built-in')
                  : t('Disabled; platform unavailable')}
              </Badge>
            )
          }
          return <Badge variant='secondary'>{t('Not registered')}</Badge>
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Open menu')}
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => props.onDetails(row.original)}>
                <Eye />
                {t('Details')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => props.onUpload(row.original.meta.key)}
              >
                <Upload />
                {t('Upload new version')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={row.original.source === 'factory'}
                variant='destructive'
                onClick={() => setDeleteTarget(row.original)}
              >
                <Trash2 />
                {t('Delete active custom version')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [communityIndex, i18n.language, props, statusMutation, t]
  )
  const plugins = pluginsQuery.data
  const kindCounts = useMemo(
    () => countPluginKinds((plugins ?? []).map(resolvePluginParts)),
    [plugins]
  )
  const kind = props.kind ?? defaultPluginKind(kindCounts)
  const kindPlugins = useMemo(
    () => (plugins ?? []).filter((plugin) => resolvePluginParts(plugin)[kind]),
    [plugins, kind]
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const { table } = useDataTable({
    data: kindPlugins,
    columns,
    totalCount: kindPlugins.length,
    columnFilters,
    onColumnFiltersChange: setColumnFilters,
    globalFilter,
    onGlobalFilterChange: setGlobalFilter,
    withFilteredRowModel: true,
    withPaginationRowModel: true,
    withSortedRowModel: true,
  })
  const hasFactoryFallback = Boolean(deleteTarget?.factory_meta)
  const usageDescription = blockedUsage ? (
    <div className='space-y-2'>
      <p>
        {t(
          '{{count}} enabled channels and {{tasks}} in-flight tasks still use this plugin.',
          {
            count: blockedUsage.channels.length,
            tasks: blockedUsage.in_flight_count,
          }
        )}
      </p>
      {blockedUsage.channels.length > 0 && (
        <ul className='list-disc pl-5'>
          {blockedUsage.channels.map((channel) => (
            <li key={channel.id}>
              #{channel.id} {channel.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : (
    ''
  )
  return (
    <>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={pluginsQuery.isLoading}
        isFetching={pluginsQuery.isFetching}
        emptyTitle={t('No plugins of this kind')}
        emptyDescription={t('Upload a JavaScript plugin.')}
        skeletonKeyPrefix='task-plugin'
        applyHeaderSize
        enableCardView
        viewModeStorageKey={VIEW_MODE_STORAGE_KEY}
        renderCard={(row) => (
          <PluginCard
            row={row}
            kind={kind}
            revoked={findRevokedEntry(communityIndex, row.original.source_hash)}
          />
        )}
        cardGridClassName='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3'
        toolbarProps={{
          searchPlaceholder: t('Filter plugins...'),
          additionalSearch: (
            <PluginKindSwitch
              value={kind}
              counts={kindCounts}
              onValueChange={props.onKindChange}
            />
          ),
        }}
      />
      <ConfirmDialog
        open={Boolean(statusConfirmation)}
        onOpenChange={(open) => {
          if (!open && !statusMutation.isPending) setStatusConfirmation(null)
        }}
        title={
          statusConfirmation?.enabled
            ? t('Enable plugin?')
            : t('Disable plugin?')
        }
        desc={
          statusConfirmation?.enabled
            ? t('Are you sure you want to enable plugin {{name}} ({{key}})?', {
                name: localizedPluginName(
                  statusConfirmation.plugin.meta,
                  i18n.language
                ),
                key: statusConfirmation.plugin.meta.key,
              })
            : t(
                'Disable plugin {{name}} ({{key}})? Requests using this plugin may be affected.',
                {
                  name:
                    statusConfirmation &&
                    localizedPluginName(
                      statusConfirmation.plugin.meta,
                      i18n.language
                    ),
                  key: statusConfirmation?.plugin.meta.key,
                }
              )
        }
        destructive={!statusConfirmation?.enabled}
        isLoading={statusMutation.isPending}
        confirmText={statusConfirmation?.enabled ? t('Enable') : t('Disable')}
        handleConfirm={() => {
          if (!statusConfirmation || statusMutation.isPending) return
          setStatusTarget(statusConfirmation.plugin)
          statusMutation.mutate({
            key: statusConfirmation.plugin.meta.key,
            enabled: statusConfirmation.enabled,
          })
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete plugin version?')}
        destructive
        isLoading={deleteMutation.isPending}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ plugin: deleteTarget })
        }}
        desc={
          hasFactoryFallback
            ? t(
                'After deleting it, the built-in plugin of the same name takes over.'
              )
            : t(
                'Channels that use this plugin stop working after it is deleted or turned off.'
              )
        }
      />
      <ConfirmDialog
        open={Boolean(blockedAction)}
        onOpenChange={(open) => {
          if (!open) {
            setBlockedAction(null)
            setBlockedUsage(null)
          }
        }}
        title={t('Plugin is still in use')}
        desc={usageDescription}
        destructive
        isLoading={statusMutation.isPending || deleteMutation.isPending}
        confirmText={t('Force operation')}
        handleConfirm={() => {
          if (blockedAction === 'delete' && deleteTarget) {
            deleteMutation.mutate({ plugin: deleteTarget, force: true })
          } else if (blockedAction === 'disable' && statusTarget) {
            statusMutation.mutate({
              key: statusTarget.meta.key,
              enabled: false,
              options: { cascade: true, force: true },
            })
          }
        }}
      >
        {blockedAction === 'disable' && blockedUsage?.channels.length ? (
          <div className='flex'>
            <Button
              variant='outline'
              onClick={() =>
                statusTarget &&
                statusMutation.mutate({
                  key: statusTarget.meta.key,
                  enabled: false,
                  options: { cascade: true },
                })
              }
            >
              {t('Cascade disable channels')}
            </Button>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
