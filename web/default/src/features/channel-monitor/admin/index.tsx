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
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import i18next from 'i18next'
import {
  Braces,
  History,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  applyChannelMonitorTemplate,
  createChannelMonitor,
  createChannelMonitorTemplate,
  deleteChannelMonitor,
  deleteChannelMonitorTemplate,
  getChannelMonitorHistory,
  getChannelMonitors,
  getChannelMonitorTemplateAssociatedMonitors,
  getChannelMonitorTemplates,
  runChannelMonitor,
  updateChannelMonitor,
  updateChannelMonitorTemplate,
} from '../api'
import {
  apiModeOptions,
  bodyOverrideModeOptions,
  channelMonitorQueryKeys,
  formatAvailability,
  formatLatency,
  formatMonitorTime,
  getMonitorStatusLabel,
  getMonitorStatusVariant,
  getProviderLabel,
  providerOptions,
  splitModelList,
} from '../lib'
import type {
  ChannelMonitor,
  ChannelMonitorApiMode,
  ChannelMonitorBodyOverrideMode,
  ChannelMonitorPayload,
  ChannelMonitorProvider,
  ChannelMonitorRunResult,
  ChannelMonitorTemplate,
  ChannelMonitorTemplatePayload,
  ChannelMonitorUpdatePayload,
} from '../types'

const route = getRouteApi('/_authenticated/channel-monitors/')

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; monitor: ChannelMonitor; runAfterSave?: boolean }
  | { type: 'delete'; monitor: ChannelMonitor }
  | { type: 'history'; monitor: ChannelMonitor }
  | { type: 'template-manager' }
  | {
      type: 'run-result'
      monitor: ChannelMonitor
      results: ChannelMonitorRunResult[]
    }
  | null

type HeaderRow = {
  id: string
  name: string
  value: string
}

type MonitorFormState = {
  name: string
  provider: ChannelMonitorProvider
  apiMode: ChannelMonitorApiMode
  endpoint: string
  apiKey: string
  primaryModel: string
  extraModelsText: string
  enabled: boolean
  userVisible: boolean
  intervalSeconds: string
  jitterSeconds: string
  templateId: string
  extraHeaderRows: HeaderRow[]
  bodyOverrideMode: ChannelMonitorBodyOverrideMode
  bodyOverrideText: string
}

type TemplateFormState = {
  id: number | null
  name: string
  provider: ChannelMonitorProvider
  apiMode: ChannelMonitorApiMode
  description: string
  extraHeaderRows: HeaderRow[]
  bodyOverrideMode: ChannelMonitorBodyOverrideMode
  bodyOverrideText: string
}

const enabledFilterOptions = [
  { label: 'Enabled', value: 'true' },
  { label: 'Disabled', value: 'false' },
]
const NO_TEMPLATE_VALUE = '__none__'
const headerNamePattern = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/

function statusBadge(status: string, label?: string) {
  return (
    <StatusBadge
      label={label ?? getMonitorStatusLabel(status)}
      variant={getMonitorStatusVariant(status)}
      showDot
      copyable={false}
    />
  )
}

function isAPIKeyDecryptError(message?: string) {
  return (message ?? '').toLowerCase().includes('api key decryption failed')
}

function headerMapToRows(headers?: Record<string, string> | null): HeaderRow[] {
  const entries = Object.entries(headers ?? {})
  if (entries.length === 0) return [createHeaderRow()]
  return entries.map(([name, value], index) => ({
    id: `${name}-${index}`,
    name,
    value,
  }))
}

function createHeaderRow(): HeaderRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: '',
    value: '',
  }
}

function rowsToHeaderMap(rows: HeaderRow[]) {
  const headers: Record<string, string> = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    headers[name] = row.value
  }
  return headers
}

function validateHeaderRows(rows: HeaderRow[], t: (key: string) => string) {
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    if (!headerNamePattern.test(name)) {
      return t('Header name contains invalid characters.')
    }
  }
  return null
}

function bodyToText(body?: Record<string, unknown> | null) {
  if (!body || Object.keys(body).length === 0) return ''
  return JSON.stringify(body, null, 2)
}

function parseBodyOverride(
  mode: ChannelMonitorBodyOverrideMode,
  text: string,
  t: (key: string) => string
) {
  if (mode === 'off') return { body: null, error: null }
  const trimmed = text.trim()
  if (!trimmed) return { body: null, error: t('Body override is required.') }
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        body: null,
        error: t('Body override must be a JSON object.'),
      }
    }
    return { body: parsed as Record<string, unknown>, error: null }
  } catch (error) {
    return {
      body: null,
      error: `${t('Invalid JSON')}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

function normalizeApiMode(
  provider: ChannelMonitorProvider,
  apiMode?: ChannelMonitorApiMode
): ChannelMonitorApiMode {
  if (provider !== 'openai') return 'chat_completions'
  return apiMode === 'responses' ? 'responses' : 'chat_completions'
}

function getBodyPlaceholder(
  provider: ChannelMonitorProvider,
  apiMode: ChannelMonitorApiMode,
  mode: ChannelMonitorBodyOverrideMode
) {
  if (provider === 'openai' && apiMode === 'responses') {
    if (mode === 'merge') return '{\n  "max_output_tokens": 20\n}'
    return '{\n  "model": "gpt-4o-mini",\n  "input": "Reply with exactly: ok",\n  "max_output_tokens": 20,\n  "stream": true\n}'
  }
  if (provider === 'openai') {
    if (mode === 'merge') return '{\n  "max_tokens": 20\n}'
    return '{\n  "model": "gpt-4o-mini",\n  "messages": [{"role": "user", "content": "Reply with exactly: ok"}],\n  "max_tokens": 20,\n  "stream": true\n}'
  }
  if (provider === 'gemini') {
    if (mode === 'merge')
      return '{\n  "generationConfig": { "maxOutputTokens": 20 }\n}'
    return '{\n  "contents": [{"parts": [{"text": "Reply with exactly: ok"}]}],\n  "generationConfig": { "maxOutputTokens": 20 }\n}'
  }
  if (mode === 'merge') return '{\n  "max_tokens": 20\n}'
  return '{\n  "model": "claude-3-5-haiku-latest",\n  "messages": [{"role": "user", "content": "Reply with exactly: ok"}],\n  "max_tokens": 20\n}'
}

function buildAdvancedPayload(
  state: Pick<
    MonitorFormState,
    'extraHeaderRows' | 'bodyOverrideMode' | 'bodyOverrideText' | 'templateId'
  >,
  t: (key: string) => string
) {
  const headerError = validateHeaderRows(state.extraHeaderRows, t)
  if (headerError) return { error: headerError }
  const parsed = parseBodyOverride(
    state.bodyOverrideMode,
    state.bodyOverrideText,
    t
  )
  if (parsed.error) return { error: parsed.error }
  return {
    error: null,
    extra_headers: rowsToHeaderMap(state.extraHeaderRows),
    body_override_mode: state.bodyOverrideMode,
    body_override: parsed.body,
    template_id:
      state.templateId && state.templateId !== NO_TEMPLATE_VALUE
        ? Number(state.templateId)
        : null,
  }
}

function templateMatchesMonitor(
  template: ChannelMonitorTemplate,
  provider: ChannelMonitorProvider,
  apiMode: ChannelMonitorApiMode
) {
  return (
    template.provider === provider &&
    normalizeApiMode(template.provider, template.api_mode) ===
      normalizeApiMode(provider, apiMode)
  )
}

function bodyModeLabel(mode: ChannelMonitorBodyOverrideMode) {
  return (
    bodyOverrideModeOptions.find((item) => item.value === mode)?.label ?? mode
  )
}

function bodyModeBadgeClassName(mode: ChannelMonitorBodyOverrideMode) {
  switch (mode) {
    case 'merge':
      return 'bg-warning/10 text-warning'
    case 'replace':
      return 'bg-info/10 text-info'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function buildFormState(
  monitor?: ChannelMonitor | null,
  defaultIntervalSeconds = 60
): MonitorFormState {
  return {
    name: monitor?.name ?? '',
    provider: monitor?.provider ?? 'openai',
    apiMode: monitor?.api_mode ?? 'chat_completions',
    endpoint: monitor?.endpoint ?? '',
    apiKey: '',
    primaryModel: monitor?.primary_model ?? '',
    extraModelsText: monitor?.extra_models?.join('\n') ?? '',
    enabled: monitor?.enabled ?? true,
    userVisible: monitor?.user_visible ?? true,
    intervalSeconds: String(
      monitor?.interval_seconds ?? defaultIntervalSeconds
    ),
    jitterSeconds: String(monitor?.jitter_seconds ?? 0),
    templateId: monitor?.template_id ? String(monitor.template_id) : '',
    extraHeaderRows: headerMapToRows(monitor?.extra_headers),
    bodyOverrideMode: monitor?.body_override_mode ?? 'off',
    bodyOverrideText: bodyToText(monitor?.body_override),
  }
}

function buildTemplateFormState(
  template?: ChannelMonitorTemplate | null,
  provider: ChannelMonitorProvider = 'openai'
): TemplateFormState {
  return {
    id: template?.id ?? null,
    name: template?.name ?? '',
    provider: template?.provider ?? provider,
    apiMode: normalizeApiMode(
      template?.provider ?? provider,
      template?.api_mode
    ),
    description: template?.description ?? '',
    extraHeaderRows: headerMapToRows(template?.extra_headers),
    bodyOverrideMode: template?.body_override_mode ?? 'off',
    bodyOverrideText: bodyToText(template?.body_override),
  }
}

export function ChannelMonitorsAdminPage() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [dialog, setDialog] = useState<DialogState>(null)
  const defaultIntervalSeconds = useMemo(() => {
    const value = Number(status?.channel_monitor_default_interval_seconds)
    return Number.isFinite(value) && value >= 15 ? value : 60
  }, [status?.channel_monitor_default_interval_seconds])

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Channel Monitors')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setDialog({ type: 'template-manager' })}
          >
            <Settings2 data-icon='inline-start' />
            {t('Request Templates')}
          </Button>
          <Button size='sm' onClick={() => setDialog({ type: 'create' })}>
            <Plus data-icon='inline-start' />
            {t('Create Monitor')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <ChannelMonitorsTable setDialog={setDialog} />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ChannelMonitorFormDialog
        key={
          dialog?.type === 'edit'
            ? `edit-${dialog.monitor.id}-${dialog.runAfterSave ? 'run' : 'save'}`
            : dialog?.type === 'create'
              ? 'create'
              : 'closed'
        }
        dialog={dialog}
        setDialog={setDialog}
        defaultIntervalSeconds={defaultIntervalSeconds}
      />
      <ChannelMonitorDeleteDialog dialog={dialog} setDialog={setDialog} />
      <ChannelMonitorHistoryDialog dialog={dialog} setDialog={setDialog} />
      <ChannelMonitorRunResultDialog dialog={dialog} setDialog={setDialog} />
      <ChannelMonitorTemplateManagerDialog
        open={dialog?.type === 'template-manager'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </>
  )
}

function ChannelMonitorsTable({
  setDialog,
}: {
  setDialog: (dialog: DialogState) => void
}) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const queryClient = useQueryClient()

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'provider', searchKey: 'provider', type: 'array' },
      { columnId: 'enabled', searchKey: 'enabled', type: 'array' },
    ],
  })

  const params = useMemo(() => {
    const providerFilter = (columnFilters.find((item) => item.id === 'provider')
      ?.value ?? []) as string[]
    const enabledFilter = (columnFilters.find((item) => item.id === 'enabled')
      ?.value ?? []) as string[]
    return {
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
      search: globalFilter || undefined,
      provider: providerFilter[0],
      enabled:
        enabledFilter[0] === undefined
          ? undefined
          : enabledFilter[0] === 'true',
    }
  }, [columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: channelMonitorQueryKeys.list(params),
    queryFn: async () => {
      const result = await getChannelMonitors(params)
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load channel monitors')
        )
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const [runningMonitorId, setRunningMonitorId] = useState<number | null>(null)
  const [updatingEnabled, setUpdatingEnabled] = useState<{
    id: number
    enabled: boolean
  } | null>(null)
  const { mutateAsync: runMonitorAsync } = useMutation({
    mutationFn: runChannelMonitor,
  })
  const { mutateAsync: updateMonitorAsync } = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: ChannelMonitorUpdatePayload
    }) => updateChannelMonitor(id, payload),
  })

  const handleToggleMonitorEnabled = useCallback(
    async (monitor: ChannelMonitor, enabled: boolean) => {
      setUpdatingEnabled({ id: monitor.id, enabled })
      try {
        const result = await updateMonitorAsync({
          id: monitor.id,
          payload: { enabled },
        })
        if (!result.success) {
          toast.error(
            result.message ||
              t(
                enabled
                  ? 'Failed to start monitor'
                  : 'Failed to pause monitor'
              )
          )
          return
        }
        toast.success(t(enabled ? 'Monitor started' : 'Monitor paused'))
        await queryClient.invalidateQueries({
          queryKey: channelMonitorQueryKeys.all,
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t(enabled ? 'Failed to start monitor' : 'Failed to pause monitor')
        )
      } finally {
        setUpdatingEnabled(null)
      }
    },
    [queryClient, t, updateMonitorAsync]
  )

  const handleRunMonitor = useCallback(
    async (monitor: ChannelMonitor) => {
      setRunningMonitorId(monitor.id)
      const toastId = toast.loading(t('Running monitor check...'))
      try {
        const result = await runMonitorAsync(monitor.id)
        if (!result.success) {
          const message = isAPIKeyDecryptError(result.message)
            ? t(
                'API key decryption failed. Edit this monitor and enter a fresh API key.'
              )
            : result.message || t('Failed to run monitor check')
          toast.error(message, { id: toastId })
          if (isAPIKeyDecryptError(result.message)) {
            setDialog({ type: 'edit', monitor, runAfterSave: true })
          }
          return
        }
        setDialog({
          type: 'run-result',
          monitor,
          results: result.data ?? [],
        })
        toast.success(t('Monitor check completed'), { id: toastId })
        await queryClient.invalidateQueries({
          queryKey: channelMonitorQueryKeys.all,
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to run monitor check'),
          { id: toastId }
        )
      } finally {
        setRunningMonitorId(null)
      }
    },
    [queryClient, runMonitorAsync, setDialog, t]
  )

  const columns = useMemo<ColumnDef<ChannelMonitor>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => t('Name'),
        cell: ({ row }) => (
          <div className='flex min-w-0 flex-col gap-1'>
            <div className='flex min-w-0 items-center gap-2'>
              <span className='truncate text-sm font-medium'>
                {row.original.name}
              </span>
              {row.original.api_key_decrypt_failed && (
                <StatusBadge
                  label={t('API key needs update')}
                  variant='danger'
                  showDot
                  copyable={false}
                />
              )}
            </div>
            <div className='text-muted-foreground truncate text-xs'>
              {row.original.endpoint}
            </div>
          </div>
        ),
        size: 220,
      },
      {
        accessorKey: 'provider',
        header: () => t('Provider'),
        cell: ({ row }) => (
          <StatusBadge
            label={getProviderLabel(row.original.provider)}
            autoColor={row.original.provider}
            copyable={false}
          />
        ),
        size: 120,
      },
      {
        accessorKey: 'primary_model',
        header: () => t('Primary Model'),
        cell: ({ row }) => (
          <div className='flex min-w-0 flex-col gap-1'>
            <span className='truncate text-sm'>
              {row.original.primary_model}
            </span>
            {row.original.extra_model_statuses.length > 0 && (
              <span className='text-muted-foreground truncate text-xs'>
                {t('{{count}} extra models', {
                  count: row.original.extra_model_statuses.length,
                })}
              </span>
            )}
          </div>
        ),
        size: 180,
      },
      {
        id: 'availability',
        header: () => t('7d Availability'),
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {formatAvailability(row.original.availability_7d)}
          </span>
        ),
        size: 120,
      },
      {
        id: 'latency',
        header: () => t('Latency'),
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            {statusBadge(
              row.original.primary_status,
              t(getMonitorStatusLabel(row.original.primary_status))
            )}
            <span className='text-muted-foreground tabular-nums'>
              {formatLatency(row.original.primary_latency_ms)}
            </span>
          </div>
        ),
        size: 180,
      },
      {
        id: 'interval',
        header: () => t('Interval / Jitter'),
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.interval_seconds}s / {row.original.jitter_seconds}s
          </span>
        ),
        size: 130,
      },
      {
        accessorKey: 'enabled',
        header: () => t('Monitor status'),
        cell: ({ row }) => {
          const monitor = row.original
          const pendingEnabled =
            updatingEnabled?.id === monitor.id ? updatingEnabled.enabled : null
          const isUpdating = pendingEnabled !== null
          const isEnabled = pendingEnabled ?? monitor.enabled
          return (
            <div className='flex items-center gap-2'>
              <Switch
                checked={isEnabled}
                disabled={isUpdating}
                size='sm'
                aria-label={
                  isEnabled ? t('Pause monitor') : t('Start monitor')
                }
                onCheckedChange={(value) =>
                  void handleToggleMonitorEnabled(monitor, value)
                }
              />
              <span className='text-muted-foreground text-sm'>
                {t(isEnabled ? 'Running' : 'Paused')}
              </span>
            </div>
          )
        },
        size: 130,
      },
      {
        accessorKey: 'user_visible',
        header: () => t('Visibility'),
        cell: ({ row }) =>
          row.original.user_visible
            ? statusBadge('operational', t('Users'))
            : statusBadge('disabled', t('Admin only')),
        size: 120,
      },
      {
        accessorKey: 'last_checked_at',
        header: () => t('Latest check time'),
        cell: ({ row }) => (
          <span className='text-muted-foreground whitespace-nowrap'>
            {formatMonitorTime(row.original.last_checked_at)}
          </span>
        ),
        size: 170,
      },
      {
        id: 'actions',
        header: () => '',
        cell: ({ row }) => (
          <ChannelMonitorRowActions
            isRunning={runningMonitorId === row.original.id}
            onEdit={() => setDialog({ type: 'edit', monitor: row.original })}
            onDelete={() =>
              setDialog({ type: 'delete', monitor: row.original })
            }
            onHistory={() =>
              setDialog({ type: 'history', monitor: row.original })
            }
            onRun={() => void handleRunMonitor(row.original)}
          />
        ),
        size: 56,
      },
    ],
    [
      handleRunMonitor,
      handleToggleMonitorEnabled,
      runningMonitorId,
      setDialog,
      t,
      updatingEnabled,
    ]
  )

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    columnFilters,
    globalFilter,
    pagination,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
    manualFiltering: true,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Channel Monitors Found')}
      emptyDescription={t(
        'Create a monitor to track upstream model availability.'
      )}
      skeletonKeyPrefix='channel-monitor-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name, endpoint, model or group...'),
        filters: [
          {
            columnId: 'provider',
            title: t('Provider'),
            options: providerOptions.map((item) => ({
              label: item.label,
              value: item.value,
            })),
            singleSelect: true,
          },
          {
            columnId: 'enabled',
            title: t('Enabled'),
            options: enabledFilterOptions.map((item) => ({
              label: t(item.label),
              value: item.value,
            })),
            singleSelect: true,
          },
        ],
      }}
    />
  )
}

function ChannelMonitorTemplateManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeProvider, setActiveProvider] =
    useState<ChannelMonitorProvider>('openai')
  const [editing, setEditing] = useState<TemplateFormState | null>(null)
  const [deleteTemplate, setDeleteTemplate] =
    useState<ChannelMonitorTemplate | null>(null)
  const [applyTemplate, setApplyTemplate] =
    useState<ChannelMonitorTemplate | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: channelMonitorQueryKeys.templates({}),
    queryFn: async () => {
      const result = await getChannelMonitorTemplates()
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load request templates')
        )
        return { items: [] }
      }
      return result.data ?? { items: [] }
    },
    enabled: open,
  })
  const templates = useMemo(() => data?.items ?? [], [data?.items])
  const countByProvider = useMemo(() => {
    const counts: Record<ChannelMonitorProvider, number> = {
      openai: 0,
      anthropic: 0,
      gemini: 0,
    }
    for (const template of templates) counts[template.provider] += 1
    return counts
  }, [templates])

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setEditing(null)
      setDeleteTemplate(null)
      setApplyTemplate(null)
    }
    onOpenChange(value)
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number | null
      payload: ChannelMonitorTemplatePayload
    }) => {
      if (id) {
        return updateChannelMonitorTemplate(id, {
          name: payload.name,
          api_mode: payload.api_mode,
          description: payload.description,
          extra_headers: payload.extra_headers,
          body_override_mode: payload.body_override_mode,
          body_override: payload.body_override,
        })
      }
      return createChannelMonitorTemplate(payload)
    },
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to save request template'))
        return
      }
      toast.success(t('Request template saved'))
      setEditing(null)
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.templates({}),
      })
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.all,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteChannelMonitorTemplate,
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to delete request template'))
        return
      }
      toast.success(t('Request template deleted'))
      setDeleteTemplate(null)
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.templates({}),
      })
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.all,
      })
    },
  })

  const updateTemplateForm = <K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K]
  ) =>
    setEditing((previous) =>
      previous ? { ...previous, [key]: value } : previous
    )

  const submitTemplate = () => {
    if (!editing) return
    if (!editing.name.trim()) {
      toast.error(t('Template name is required'))
      return
    }
    const advanced = buildAdvancedPayload(
      {
        templateId: '',
        extraHeaderRows: editing.extraHeaderRows,
        bodyOverrideMode: editing.bodyOverrideMode,
        bodyOverrideText: editing.bodyOverrideText,
      },
      t
    )
    if (advanced.error) {
      toast.error(advanced.error)
      return
    }
    saveMutation.mutate({
      id: editing.id,
      payload: {
        name: editing.name.trim(),
        provider: editing.provider,
        api_mode: normalizeApiMode(editing.provider, editing.apiMode),
        description: editing.description.trim(),
        extra_headers: advanced.extra_headers,
        body_override_mode: advanced.body_override_mode,
        body_override: advanced.body_override,
      },
    })
  }

  const renderTemplateList = (provider: ChannelMonitorProvider) => {
    const providerTemplates = templates.filter(
      (template) => template.provider === provider
    )
    if (isLoading) {
      return (
        <div className='flex flex-col gap-2'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className='h-20 w-full rounded-lg' />
          ))}
        </div>
      )
    }
    if (providerTemplates.length === 0) {
      return (
        <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
          {t('No templates for this provider yet.')}
        </div>
      )
    }
    return (
      <div className='flex flex-col gap-2'>
        {providerTemplates.map((template) => (
          <div
            key={template.id}
            className='bg-background rounded-lg border p-3'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {template.name}
                  </span>
                  <Badge
                    variant='secondary'
                    className={cn(
                      'rounded-md',
                      bodyModeBadgeClassName(template.body_override_mode)
                    )}
                  >
                    {t(bodyModeLabel(template.body_override_mode))}
                  </Badge>
                  {template.provider === 'openai' && (
                    <Badge variant='outline' className='rounded-md'>
                      {t(
                        template.api_mode === 'responses'
                          ? 'Responses'
                          : 'Chat Completions'
                      )}
                    </Badge>
                  )}
                  {template.associated_monitors > 0 && (
                    <span className='text-muted-foreground text-xs'>
                      {t('{{count}} associated monitors', {
                        count: template.associated_monitors,
                      })}
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className='text-muted-foreground mt-1 truncate text-xs'>
                    {template.description}
                  </p>
                )}
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('{{count}} extra headers', {
                    count: Object.keys(template.extra_headers ?? {}).length,
                  })}
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  disabled={template.associated_monitors === 0}
                  onClick={() => setApplyTemplate(template)}
                >
                  <RefreshCw />
                  <span className='sr-only'>{t('Apply template')}</span>
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => setEditing(buildTemplateFormState(template))}
                >
                  <Pencil />
                  <span className='sr-only'>{t('Edit')}</span>
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => setDeleteTemplate(template)}
                >
                  <Trash2 />
                  <span className='sr-only'>{t('Delete')}</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{t('Request template manager')}</DialogTitle>
            <DialogDescription>
              {t(
                'Reusable monitor request headers and body overrides for each provider.'
              )}
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <FieldGroup>
              <div className='grid gap-4 md:grid-cols-2'>
                <Field>
                  <FieldLabel htmlFor='template-name'>
                    {t('Template name')}
                  </FieldLabel>
                  <Input
                    id='template-name'
                    value={editing.name}
                    onChange={(event) =>
                      updateTemplateForm('name', event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>{t('Provider')}</FieldLabel>
                  {editing.id ? (
                    <div className='flex h-8 items-center'>
                      <StatusBadge
                        label={getProviderLabel(editing.provider)}
                        autoColor={editing.provider}
                        copyable={false}
                      />
                    </div>
                  ) : (
                    <Select
                      value={editing.provider}
                      onValueChange={(value) => {
                        if (!value) return
                        const provider = value as ChannelMonitorProvider
                        setEditing((previous) =>
                          previous
                            ? {
                                ...previous,
                                provider,
                                apiMode: normalizeApiMode(
                                  provider,
                                  previous.apiMode
                                ),
                              }
                            : previous
                        )
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {providerOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>

              {editing.provider === 'openai' && (
                <Field>
                  <FieldLabel>{t('API Mode')}</FieldLabel>
                  <Select
                    items={apiModeOptions}
                    value={editing.apiMode}
                    onValueChange={(value) =>
                      value &&
                      updateTemplateForm(
                        'apiMode',
                        value as ChannelMonitorApiMode
                      )
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {apiModeOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {t(item.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor='template-description'>
                  {t('Description')}
                </FieldLabel>
                <Input
                  id='template-description'
                  value={editing.description}
                  onChange={(event) =>
                    updateTemplateForm('description', event.target.value)
                  }
                />
              </Field>

              <MonitorAdvancedRequestConfig
                provider={editing.provider}
                apiMode={editing.apiMode}
                templates={[]}
                selectedTemplate={null}
                templateId={NO_TEMPLATE_VALUE}
                extraHeaderRows={editing.extraHeaderRows}
                bodyOverrideMode={editing.bodyOverrideMode}
                bodyOverrideText={editing.bodyOverrideText}
                onTemplateChange={() => undefined}
                onHeaderRowsChange={(rows) =>
                  updateTemplateForm('extraHeaderRows', rows)
                }
                onBodyOverrideModeChange={(mode) => {
                  updateTemplateForm('bodyOverrideMode', mode)
                  if (mode === 'off') updateTemplateForm('bodyOverrideText', '')
                }}
                onBodyOverrideTextChange={(value) =>
                  updateTemplateForm('bodyOverrideText', value)
                }
                showTemplateSelect={false}
              />
            </FieldGroup>
          ) : (
            <Tabs
              value={activeProvider}
              onValueChange={(value) =>
                value && setActiveProvider(value as ChannelMonitorProvider)
              }
            >
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                  {providerOptions.map((item) => (
                    <TabsTrigger key={item.value} value={item.value}>
                      {item.label}
                      {countByProvider[item.value] > 0 && (
                        <Badge
                          variant='secondary'
                          className='ml-1 rounded-full px-1.5'
                        >
                          {countByProvider[item.value]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  size='sm'
                  onClick={() =>
                    setEditing(buildTemplateFormState(null, activeProvider))
                  }
                >
                  <Plus data-icon='inline-start' />
                  {t('New template')}
                </Button>
              </div>
              {providerOptions.map((item) => (
                <TabsContent key={item.value} value={item.value}>
                  <ScrollArea className='h-[min(58vh,32rem)] pr-3'>
                    {renderTemplateList(item.value)}
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}

          <DialogFooter>
            {editing ? (
              <>
                <Button
                  variant='outline'
                  onClick={() => setEditing(null)}
                  disabled={saveMutation.isPending}
                >
                  {t('Back')}
                </Button>
                <Button
                  onClick={submitTemplate}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Spinner data-icon='inline-start' />
                  )}
                  {editing.id ? t('Update') : t('Create')}
                </Button>
              </>
            ) : (
              <Button
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isFetching}
              >
                {t('Close')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTemplate)}
        onOpenChange={(value) => !value && setDeleteTemplate(null)}
        title={t('Delete request template')}
        desc={
          deleteTemplate
            ? t(
                'Delete template {{name}}? {{count}} associated monitors will keep their current request snapshot.',
                {
                  name: deleteTemplate.name,
                  count: deleteTemplate.associated_monitors,
                }
              )
            : ''
        }
        confirmText={t('Delete')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() =>
          deleteTemplate && deleteMutation.mutate(deleteTemplate.id)
        }
      />

      <ChannelMonitorTemplateApplyPickerDialog
        template={applyTemplate}
        open={Boolean(applyTemplate)}
        onOpenChange={(value) => !value && setApplyTemplate(null)}
      />
    </>
  )
}

function ChannelMonitorTemplateApplyPickerDialog({
  template,
  open,
  onOpenChange,
}: {
  template: ChannelMonitorTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: template
      ? channelMonitorQueryKeys.templateAssociatedMonitors(template.id)
      : channelMonitorQueryKeys.templateAssociatedMonitors(0),
    queryFn: async () => {
      if (!template) return { items: [] }
      const result = await getChannelMonitorTemplateAssociatedMonitors(
        template.id
      )
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load associated monitors')
        )
        return { items: [] }
      }
      return result.data ?? { items: [] }
    },
    enabled: open && Boolean(template),
  })
  const monitors = useMemo(() => data?.items ?? [], [data?.items])
  const effectiveSelectedIds = useMemo(
    () => selectedIds ?? monitors.map((monitor) => monitor.id),
    [monitors, selectedIds]
  )
  const selectedSet = useMemo(
    () => new Set(effectiveSelectedIds),
    [effectiveSelectedIds]
  )

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!template)
        return { success: false, message: '', data: { affected: 0 } }
      return applyChannelMonitorTemplate(template.id, effectiveSelectedIds)
    },
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to apply request template'))
        return
      }
      toast.success(
        t('Template applied to {{count}} monitors', {
          count: result.data?.affected ?? 0,
        })
      )
      handleOpenChange(false)
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.all,
      })
    },
  })

  const toggleMonitor = (id: number) => {
    setSelectedIds((previous) =>
      (previous ?? effectiveSelectedIds).includes(id)
        ? (previous ?? effectiveSelectedIds).filter((item) => item !== id)
        : [...(previous ?? effectiveSelectedIds), id]
    )
  }

  const handleOpenChange = (value: boolean) => {
    if (!value) setSelectedIds(null)
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {t('Apply template')} · {template?.name ?? ''}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Applying overwrites the saved request snapshot on selected associated monitors.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex flex-col gap-2'>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className='h-10 w-full' />
            ))}
          </div>
        ) : monitors.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
            {t('No associated monitors')}
          </div>
        ) : (
          <div className='flex flex-col gap-3'>
            <div className='flex items-center gap-3 text-xs'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() =>
                  setSelectedIds(monitors.map((monitor) => monitor.id))
                }
              >
                {t('Select all')}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setSelectedIds([])}
              >
                {t('Select none')}
              </Button>
              <span className='text-muted-foreground ml-auto'>
                {t('{{selected}} / {{total}} selected', {
                  selected: effectiveSelectedIds.length,
                  total: monitors.length,
                })}
              </span>
            </div>
            <ScrollArea className='h-80 rounded-lg border'>
              <div className='divide-border divide-y'>
                {monitors.map((monitor) => (
                  <button
                    key={monitor.id}
                    type='button'
                    className='hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left text-sm'
                    onClick={() => toggleMonitor(monitor.id)}
                  >
                    <Checkbox
                      checked={selectedSet.has(monitor.id)}
                      onCheckedChange={() => toggleMonitor(monitor.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('Select monitor')}
                    />
                    <span className='min-w-0 flex-1 truncate font-medium'>
                      {monitor.name}
                    </span>
                    <StatusBadge
                      label={getProviderLabel(monitor.provider)}
                      autoColor={monitor.provider}
                      copyable={false}
                    />
                    {!monitor.enabled && (
                      <Badge variant='secondary'>{t('Disabled')}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={applyMutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={
              applyMutation.isPending ||
              effectiveSelectedIds.length === 0 ||
              isLoading
            }
          >
            {applyMutation.isPending && <Spinner data-icon='inline-start' />}
            {t('Apply to monitors')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChannelMonitorRowActions({
  isRunning,
  onEdit,
  onDelete,
  onHistory,
  onRun,
}: {
  isRunning: boolean
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
  onRun: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon-sm' disabled={isRunning} />}
      >
        {isRunning ? <Spinner /> : <MoreHorizontal />}
        <span className='sr-only'>{t('Open menu')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onRun} disabled={isRunning}>
            {isRunning ? <Spinner /> : <Play />}
            {isRunning ? t('Running') : t('Run Now')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onHistory}>
            <History />
            {t('View History')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            {t('Edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant='destructive'>
            <Trash2 />
            {t('Delete')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChannelMonitorFormDialog({
  dialog,
  setDialog,
  defaultIntervalSeconds,
}: {
  dialog: DialogState
  setDialog: (dialog: DialogState) => void
  defaultIntervalSeconds: number
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const monitor = dialog?.type === 'edit' ? dialog.monitor : null
  const runAfterSave = dialog?.type === 'edit' && dialog.runAfterSave === true
  const open = dialog?.type === 'create' || dialog?.type === 'edit'
  const [formState, setFormState] = useState<MonitorFormState>(() =>
    buildFormState(monitor, defaultIntervalSeconds)
  )
  const [isRunningAfterSave, setIsRunningAfterSave] = useState(false)

  const { data: templateData } = useQuery({
    queryKey: channelMonitorQueryKeys.templates({}),
    queryFn: async () => {
      const result = await getChannelMonitorTemplates()
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load request templates')
        )
        return { items: [] }
      }
      return result.data ?? { items: [] }
    },
    enabled: open,
    placeholderData: (previousData) => previousData,
  })

  const mutation = useMutation({
    mutationFn: async (
      payload: ChannelMonitorPayload & { clear_template?: boolean }
    ) => {
      if (monitor) {
        const updatePayload: ChannelMonitorUpdatePayload = { ...payload }
        if (!updatePayload.api_key?.trim()) delete updatePayload.api_key
        return updateChannelMonitor(monitor.id, updatePayload)
      }
      return createChannelMonitor(payload)
    },
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to save monitor'))
        return
      }
      const savedMonitor = result.data
      if (runAfterSave && savedMonitor) {
        setIsRunningAfterSave(true)
        const toastId = toast.loading(t('Running monitor check...'))
        try {
          const runResult = await runChannelMonitor(savedMonitor.id)
          if (!runResult.success) {
            toast.error(
              isAPIKeyDecryptError(runResult.message)
                ? t(
                    'API key decryption failed. Edit this monitor and enter a fresh API key.'
                  )
                : runResult.message || t('Failed to run monitor check'),
              { id: toastId }
            )
            return
          }
          toast.success(t('Monitor check completed'), { id: toastId })
          setDialog({
            type: 'run-result',
            monitor: savedMonitor,
            results: runResult.data ?? [],
          })
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('Failed to run monitor check'),
            { id: toastId }
          )
        } finally {
          setIsRunningAfterSave(false)
          await queryClient.invalidateQueries({
            queryKey: channelMonitorQueryKeys.all,
          })
        }
        return
      }
      toast.success(t('Monitor saved'))
      setDialog(null)
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.all,
      })
    },
  })

  const update = <K extends keyof MonitorFormState>(
    key: K,
    value: MonitorFormState[K]
  ) => setFormState((previous) => ({ ...previous, [key]: value }))

  const providerItems = providerOptions.map((item) => ({
    value: item.value,
    label: item.label,
  }))
  const modeItems = apiModeOptions.map((item) => ({
    value: item.value,
    label: t(item.label),
  }))
  const matchingTemplates = (templateData?.items ?? []).filter((template) =>
    templateMatchesMonitor(template, formState.provider, formState.apiMode)
  )
  const selectedTemplate =
    formState.templateId && formState.templateId !== NO_TEMPLATE_VALUE
      ? (templateData?.items ?? []).find(
          (template) => String(template.id) === formState.templateId
        )
      : null

  const handleProviderChange = (value: string | null) => {
    if (!value) return
    const provider = value as ChannelMonitorProvider
    setFormState((previous) => ({
      ...previous,
      provider,
      apiMode: provider === 'openai' ? previous.apiMode : 'chat_completions',
      templateId: '',
      extraHeaderRows: headerMapToRows(),
      bodyOverrideMode: 'off',
      bodyOverrideText: '',
    }))
  }

  const handleApiModeChange = (value: string | null) => {
    if (!value) return
    setFormState((previous) => ({
      ...previous,
      apiMode: value as ChannelMonitorApiMode,
      templateId: '',
      extraHeaderRows: headerMapToRows(),
      bodyOverrideMode: 'off',
      bodyOverrideText: '',
    }))
  }

  const applyTemplateToForm = (template: ChannelMonitorTemplate | null) => {
    setFormState((previous) => ({
      ...previous,
      templateId: template ? String(template.id) : '',
      extraHeaderRows: headerMapToRows(template?.extra_headers),
      bodyOverrideMode: template?.body_override_mode ?? 'off',
      bodyOverrideText: bodyToText(template?.body_override),
    }))
  }

  const submit = () => {
    if (monitor?.api_key_decrypt_failed && !formState.apiKey.trim()) {
      toast.error(
        t('API key is required because the stored key cannot be decrypted.')
      )
      return
    }
    const advanced = buildAdvancedPayload(formState, t)
    if (advanced.error) {
      toast.error(advanced.error)
      return
    }
    const payload: ChannelMonitorPayload & { clear_template?: boolean } = {
      name: formState.name.trim(),
      provider: formState.provider,
      api_mode: formState.apiMode,
      endpoint: formState.endpoint.trim(),
      api_key: formState.apiKey.trim(),
      primary_model: formState.primaryModel.trim(),
      extra_models: splitModelList(formState.extraModelsText),
      group_name: formState.name.trim(),
      enabled: formState.enabled,
      user_visible: formState.userVisible,
      interval_seconds: Number(formState.intervalSeconds) || 0,
      jitter_seconds: Number(formState.jitterSeconds) || 0,
      extra_headers: advanced.extra_headers,
      body_override_mode: advanced.body_override_mode,
      body_override: advanced.body_override,
    }
    if (advanced.template_id) {
      payload.template_id = advanced.template_id
    } else if (monitor?.template_id) {
      payload.clear_template = true
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && setDialog(null)}>
      <DialogContent className='max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[960px]'>
        <DialogHeader className='px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pt-5 sm:pb-4'>
          <DialogTitle>
            {monitor ? t('Edit Channel Monitor') : t('Create Channel Monitor')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure an independent upstream health check.')}
          </DialogDescription>
        </DialogHeader>

        <form
          id='channel-monitor-form'
          className='min-h-0 overflow-y-auto px-4 pb-4 sm:px-6'
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <FieldGroup className='gap-4'>
            <Field>
              <FieldLabel htmlFor='monitor-name'>{t('Name')}</FieldLabel>
              <Input
                id='monitor-name'
                value={formState.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </Field>

            <div className='grid gap-4 md:grid-cols-2'>
              <Field>
                <FieldLabel>{t('Provider')}</FieldLabel>
                <Select
                  items={providerItems}
                  value={formState.provider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {providerItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('API Mode')}</FieldLabel>
                <Select
                  items={modeItems}
                  value={formState.apiMode}
                  onValueChange={handleApiModeChange}
                  disabled={formState.provider !== 'openai'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {modeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {t('Responses mode is available for OpenAI monitors only.')}
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor='monitor-endpoint'>
                {t('Endpoint')}
              </FieldLabel>
              <Input
                id='monitor-endpoint'
                value={formState.endpoint}
                onChange={(event) => update('endpoint', event.target.value)}
                placeholder='https://api.openai.com'
              />
              <FieldDescription>
                {t('Use an HTTPS origin without path, query, or fragment.')}
              </FieldDescription>
            </Field>

            <div className='grid gap-4 md:grid-cols-2'>
              <Field>
                <FieldLabel htmlFor='monitor-api-key'>
                  {t('API Key')}
                </FieldLabel>
                <Input
                  id='monitor-api-key'
                  type='password'
                  value={formState.apiKey}
                  onChange={(event) => update('apiKey', event.target.value)}
                  placeholder={
                    monitor?.api_key_masked
                      ? `${t('Current')}: ${monitor.api_key_masked}`
                      : monitor?.api_key_decrypt_failed
                        ? t('Re-enter API key')
                        : ''
                  }
                />
                <FieldDescription>
                  {monitor?.api_key_decrypt_failed
                    ? t(
                        'The stored API key cannot be decrypted. Enter a fresh key to recover this monitor.'
                      )
                    : monitor
                      ? t('Leave blank to keep the current encrypted key.')
                      : t('The key is encrypted before storage.')}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor='monitor-primary-model'>
                  {t('Primary Model')}
                </FieldLabel>
                <Input
                  id='monitor-primary-model'
                  value={formState.primaryModel}
                  onChange={(event) =>
                    update('primaryModel', event.target.value)
                  }
                  placeholder='gpt-4o-mini'
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor='monitor-extra-models'>
                {t('Extra Models')}
              </FieldLabel>
              <Textarea
                id='monitor-extra-models'
                rows={4}
                value={formState.extraModelsText}
                onChange={(event) =>
                  update('extraModelsText', event.target.value)
                }
                placeholder={t('one model per line')}
              />
            </Field>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(16rem,2fr)]'>
              <Field>
                <FieldLabel htmlFor='monitor-interval'>
                  {t('Interval (seconds)')}
                </FieldLabel>
                <Input
                  id='monitor-interval'
                  type='number'
                  min={15}
                  max={3600}
                  value={formState.intervalSeconds}
                  onChange={(event) =>
                    update('intervalSeconds', event.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor='monitor-jitter'>
                  {t('Jitter (seconds)')}
                </FieldLabel>
                <Input
                  id='monitor-jitter'
                  type='number'
                  min={0}
                  max={3600}
                  value={formState.jitterSeconds}
                  onChange={(event) =>
                    update('jitterSeconds', event.target.value)
                  }
                />
                <FieldDescription>
                  {t('Interval minus jitter must stay at least 15 seconds.')}
                </FieldDescription>
              </Field>
              <Field
                orientation='horizontal'
                className='w-fit self-start md:pt-7 [&>[data-slot=field-label]]:flex-none'
              >
                <FieldLabel htmlFor='monitor-enabled'>
                  {t('Enabled')}
                </FieldLabel>
                <Switch
                  id='monitor-enabled'
                  checked={formState.enabled}
                  onCheckedChange={(value) => update('enabled', value)}
                />
              </Field>
              <Field>
                <FieldLabel id='monitor-visibility-label'>
                  {t('Visibility')}
                </FieldLabel>
                <ToggleGroup
                  aria-labelledby='monitor-visibility-label'
                  value={[formState.userVisible ? 'users' : 'admin']}
                  onValueChange={(values) => {
                    const value = values[0]
                    if (!value) return
                    update('userVisible', value === 'users')
                  }}
                  className='grid w-full grid-cols-2'
                  variant='outline'
                >
                  <ToggleGroupItem
                    value='users'
                    className='w-full justify-center'
                  >
                    {t('Visible to users')}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value='admin'
                    className='w-full justify-center'
                  >
                    {t('Admin only')}
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {formState.userVisible
                    ? t(
                        'Shown in the channel status page for regular users and administrators.'
                      )
                    : t(
                        'Still checked on schedule, but shown only to administrators.'
                      )}
                </FieldDescription>
              </Field>
            </div>

            <MonitorAdvancedRequestConfig
              provider={formState.provider}
              apiMode={formState.apiMode}
              templates={matchingTemplates}
              selectedTemplate={selectedTemplate}
              templateId={formState.templateId || NO_TEMPLATE_VALUE}
              extraHeaderRows={formState.extraHeaderRows}
              bodyOverrideMode={formState.bodyOverrideMode}
              bodyOverrideText={formState.bodyOverrideText}
              onTemplateChange={applyTemplateToForm}
              onHeaderRowsChange={(rows) => update('extraHeaderRows', rows)}
              onBodyOverrideModeChange={(mode) => {
                update('bodyOverrideMode', mode)
                if (mode === 'off') update('bodyOverrideText', '')
              }}
              onBodyOverrideTextChange={(value) =>
                update('bodyOverrideText', value)
              }
            />
          </FieldGroup>
        </form>

        <DialogFooter className='m-0 px-4 py-3 sm:px-6'>
          <Button
            type='button'
            variant='outline'
            onClick={() => setDialog(null)}
            disabled={mutation.isPending || isRunningAfterSave}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='channel-monitor-form'
            disabled={mutation.isPending || isRunningAfterSave}
          >
            {(mutation.isPending || isRunningAfterSave) && (
              <Spinner data-icon='inline-start' />
            )}
            {runAfterSave ? t('Save and Run') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MonitorAdvancedRequestConfig({
  provider,
  apiMode,
  templates,
  selectedTemplate,
  templateId,
  extraHeaderRows,
  bodyOverrideMode,
  bodyOverrideText,
  onTemplateChange,
  onHeaderRowsChange,
  onBodyOverrideModeChange,
  onBodyOverrideTextChange,
  showTemplateSelect = true,
}: {
  provider: ChannelMonitorProvider
  apiMode: ChannelMonitorApiMode
  templates: ChannelMonitorTemplate[]
  selectedTemplate: ChannelMonitorTemplate | null | undefined
  templateId: string
  extraHeaderRows: HeaderRow[]
  bodyOverrideMode: ChannelMonitorBodyOverrideMode
  bodyOverrideText: string
  onTemplateChange: (template: ChannelMonitorTemplate | null) => void
  onHeaderRowsChange: (rows: HeaderRow[]) => void
  onBodyOverrideModeChange: (mode: ChannelMonitorBodyOverrideMode) => void
  onBodyOverrideTextChange: (value: string) => void
  showTemplateSelect?: boolean
}) {
  const { t } = useTranslation()
  const headerError = validateHeaderRows(extraHeaderRows, t)

  const updateRow = (id: string, patch: Partial<HeaderRow>) => {
    onHeaderRowsChange(
      extraHeaderRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }

  const removeRow = (id: string) => {
    const next = extraHeaderRows.filter((row) => row.id !== id)
    onHeaderRowsChange(next.length ? next : [createHeaderRow()])
  }

  const formatBody = () => {
    const parsed = parseBodyOverride(bodyOverrideMode, bodyOverrideText, t)
    if (parsed.error) {
      toast.error(parsed.error)
      return
    }
    onBodyOverrideTextChange(
      parsed.body ? JSON.stringify(parsed.body, null, 2) : ''
    )
  }

  return (
    <div className='bg-muted/20 rounded-lg border p-3'>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <Settings2 className='size-4' aria-hidden='true' />
            {t('Advanced request')}
          </div>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Templates copy a request snapshot into this monitor. Later template edits are not auto-synced.'
            )}
          </p>
        </div>
        {selectedTemplate && (
          <Badge variant='secondary' className='shrink-0 rounded-md'>
            {selectedTemplate.name}
          </Badge>
        )}
      </div>

      <FieldGroup>
        {showTemplateSelect && (
          <Field>
            <FieldLabel>{t('Request template')}</FieldLabel>
            <Select
              value={templateId}
              onValueChange={(value) => {
                if (!value || value === NO_TEMPLATE_VALUE) {
                  onTemplateChange(null)
                  return
                }
                const template = templates.find(
                  (item) => String(item.id) === value
                )
                onTemplateChange(template ?? null)
              }}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder={t('No template')} />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value={NO_TEMPLATE_VALUE}>
                    {t('No template')}
                  </SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      <span className='truncate'>{template.name}</span>
                      <span className='text-muted-foreground text-xs'>
                        {t(bodyModeLabel(template.body_override_mode))}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {templates.length
                ? t(
                    'Picking a template copies its headers and body to this monitor.'
                  )
                : t('No templates for this provider yet.')}
            </FieldDescription>
          </Field>
        )}

        <Field>
          <FieldLabel>{t('Extra headers')}</FieldLabel>
          <div className='flex flex-col gap-2'>
            {extraHeaderRows.map((row) => (
              <div
                key={row.id}
                className='grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)_2rem]'
              >
                <Input
                  value={row.name}
                  spellCheck={false}
                  className='font-mono text-xs'
                  placeholder={t('Header name')}
                  onChange={(event) =>
                    updateRow(row.id, { name: event.target.value })
                  }
                />
                <Input
                  value={row.value}
                  spellCheck={false}
                  className='font-mono text-xs'
                  placeholder={t('Header value')}
                  onChange={(event) =>
                    updateRow(row.id, { value: event.target.value })
                  }
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => removeRow(row.id)}
                >
                  <X />
                  <span className='sr-only'>{t('Delete')}</span>
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='w-fit border-dashed'
              onClick={() =>
                onHeaderRowsChange([...extraHeaderRows, createHeaderRow()])
              }
            >
              <Plus data-icon='inline-start' />
              {t('Add header')}
            </Button>
          </div>
          <FieldDescription>
            {headerError ??
              t('Authorization is managed by the monitor API key.')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>{t('Body override')}</FieldLabel>
          <ToggleGroup
            value={[bodyOverrideMode]}
            onValueChange={(values) => {
              const value = values[0] as
                | ChannelMonitorBodyOverrideMode
                | undefined
              if (value) onBodyOverrideModeChange(value)
            }}
            className='grid w-full grid-cols-3'
            variant='outline'
          >
            {bodyOverrideModeOptions.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className='w-full justify-center'
              >
                {t(item.label)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            {bodyOverrideMode === 'merge'
              ? t('Merge adds safe fields to the default monitor request.')
              : bodyOverrideMode === 'replace'
                ? t('Replace sends the JSON body exactly as written.')
                : t('Use the default monitor request body.')}
          </FieldDescription>
        </Field>

        {bodyOverrideMode !== 'off' && (
          <Field>
            <div className='flex items-center justify-between gap-3'>
              <FieldLabel htmlFor='monitor-body-override'>
                {t('Body JSON')}
              </FieldLabel>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={formatBody}
                disabled={!bodyOverrideText.trim()}
              >
                <Braces data-icon='inline-start' />
                {t('Format JSON')}
              </Button>
            </div>
            <Textarea
              id='monitor-body-override'
              rows={8}
              spellCheck={false}
              value={bodyOverrideText}
              className='font-mono text-xs'
              placeholder={getBodyPlaceholder(
                provider,
                apiMode,
                bodyOverrideMode
              )}
              onChange={(event) => onBodyOverrideTextChange(event.target.value)}
            />
            <FieldDescription>
              {t('Body override must be a JSON object.')}
            </FieldDescription>
          </Field>
        )}
      </FieldGroup>
    </div>
  )
}

function ChannelMonitorDeleteDialog({
  dialog,
  setDialog,
}: {
  dialog: DialogState
  setDialog: (dialog: DialogState) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const monitor = dialog?.type === 'delete' ? dialog.monitor : null
  const mutation = useMutation({
    mutationFn: deleteChannelMonitor,
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to delete monitor'))
        return
      }
      toast.success(t('Monitor deleted'))
      setDialog(null)
      await queryClient.invalidateQueries({
        queryKey: channelMonitorQueryKeys.all,
      })
    },
  })

  return (
    <ConfirmDialog
      open={Boolean(monitor)}
      onOpenChange={(value) => !value && setDialog(null)}
      title={t('Delete Channel Monitor')}
      desc={t('This will also delete the monitor history.')}
      confirmText={t('Delete')}
      destructive
      isLoading={mutation.isPending}
      handleConfirm={() => monitor && mutation.mutate(monitor.id)}
    />
  )
}

function ChannelMonitorHistoryDialog({
  dialog,
  setDialog,
}: {
  dialog: DialogState
  setDialog: (dialog: DialogState) => void
}) {
  const { t } = useTranslation()
  const monitor = dialog?.type === 'history' ? dialog.monitor : null
  const { data, isLoading } = useQuery({
    queryKey: monitor
      ? channelMonitorQueryKeys.history(monitor.id)
      : channelMonitorQueryKeys.history(0),
    queryFn: async () => {
      if (!monitor) return { items: [] }
      const result = await getChannelMonitorHistory(monitor.id, { limit: 100 })
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load monitor history')
        )
        return { items: [] }
      }
      return result.data ?? { items: [] }
    },
    enabled: Boolean(monitor),
  })

  return (
    <Dialog
      open={Boolean(monitor)}
      onOpenChange={(value) => !value && setDialog(null)}
    >
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Monitor History')}</DialogTitle>
          <DialogDescription>
            {monitor?.name ? `${monitor.name} · ${monitor.primary_model}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] overflow-auto rounded-lg border'>
          {isLoading ? (
            <div className='flex flex-col gap-2 p-3'>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className='h-9 w-full' />
              ))}
            </div>
          ) : data?.items.length ? (
            <div className='divide-border divide-y'>
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className='grid gap-2 px-3 py-2 text-sm md:grid-cols-[minmax(0,1fr)_120px_120px_160px]'
                >
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{item.model}</div>
                    {item.message && (
                      <div className='text-muted-foreground truncate text-xs'>
                        {item.message}
                      </div>
                    )}
                  </div>
                  <div>
                    {statusBadge(
                      item.status,
                      t(getMonitorStatusLabel(item.status))
                    )}
                  </div>
                  <div className='text-muted-foreground tabular-nums'>
                    {formatLatency(item.latency_ms)}
                  </div>
                  <div className='text-muted-foreground whitespace-nowrap'>
                    {formatMonitorTime(item.checked_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-muted-foreground p-8 text-center text-sm'>
              {t('No history records yet.')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChannelMonitorRunResultDialog({
  dialog,
  setDialog,
}: {
  dialog: DialogState
  setDialog: (dialog: DialogState) => void
}) {
  const { t } = useTranslation()
  const resultDialog = dialog?.type === 'run-result' ? dialog : null

  return (
    <Dialog
      open={Boolean(resultDialog)}
      onOpenChange={(value) => !value && setDialog(null)}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Run Result')}</DialogTitle>
          <DialogDescription>
            {resultDialog?.monitor.name ?? ''}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          {resultDialog?.results.map((item) => (
            <div
              key={`${item.model}-${item.checked_at}`}
              className={cn(
                'grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[minmax(0,1fr)_120px_120px]',
                item.status !== 'operational' && 'bg-muted/30'
              )}
            >
              <div className='min-w-0'>
                <div className='truncate font-medium'>{item.model}</div>
                {item.message && (
                  <div className='text-muted-foreground truncate text-xs'>
                    {item.message}
                  </div>
                )}
              </div>
              <div>
                {statusBadge(
                  item.status,
                  t(getMonitorStatusLabel(item.status))
                )}
              </div>
              <div className='text-muted-foreground tabular-nums'>
                {formatLatency(item.latency_ms)}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setDialog(null)}>{t('Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
