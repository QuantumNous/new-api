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
import {
  Copy01Icon,
  Download01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth-store'

import { exportAgentCodes, getAgentCodes } from '../api'
import { deriveAgentCodeStatus } from '../lib/money'
import {
  agentQueryKeys,
  agentUserQueryKey,
  downloadAgentExport,
  isRefundableAgentCode,
  localDateInputToTimestamp,
  retainSameAgentPage,
  timestampToLocalDateInput,
  toggleRefundSelection,
  type AgentWorkspaceSearch,
} from '../lib/workspace'
import type { AgentCode } from '../types'
import { AgentTableShell } from './agent-table-shell'
import { RefundDialog } from './refund-dialog'

type AgentCodesTableProps = {
  search: AgentWorkspaceSearch
  onSearchChange: (updates: Partial<AgentWorkspaceSearch>) => void
}

type AgentCodesTableMeta = {
  selectedIDs: ReadonlySet<number>
  toggleCode: (code: AgentCode, checked: boolean) => void
  copyCode: (code: AgentCode) => Promise<void>
}

export function AgentCodesTable(props: AgentCodesTableProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const [selectedIDs, setSelectedIDs] = useState<Set<number>>(new Set())
  const [refundOpen, setRefundOpen] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const page = props.search.p ?? 1
  const pageSize = props.search.page_size ?? 20
  const codesQuery = useQuery({
    queryKey: agentUserQueryKey(
      agentQueryKeys.codes,
      userID,
      page,
      pageSize,
      props.search.plan_id,
      props.search.order_id,
      props.search.code_status,
      props.search.start_timestamp,
      props.search.end_timestamp
    ),
    queryFn: async () => {
      const response = await getAgentCodes({
        p: page,
        page_size: pageSize,
        plan_id: props.search.plan_id,
        order_id: props.search.order_id,
        status: props.search.code_status,
        start_timestamp: props.search.start_timestamp,
        end_timestamp: props.search.end_timestamp,
      })
      if (!response.success) throw new Error('Agent codes unavailable')
      return response.data
    },
    placeholderData: (previous, previousQuery) =>
      retainSameAgentPage(
        userID,
        typeof previousQuery?.queryKey[2] === 'number'
          ? previousQuery.queryKey[2]
          : undefined,
        previous
      ),
  })

  const toggleCode = useCallback(
    (code: AgentCode, checked: boolean) => {
      if (checked && !isRefundableAgentCode(code)) return
      setSelectedIDs((current) => {
        const result = toggleRefundSelection(current, code.id, checked)
        if (!result.changed && checked && !current.has(code.id)) {
          toast.error(t('You can select at most 100 codes for one refund.'))
          return current
        }
        return result.selection
      })
    },
    [t]
  )

  const copyCode = useCallback(
    async (code: AgentCode) => {
      if (!code.code_visible || !code.code) return
      try {
        await navigator.clipboard.writeText(code.code)
        toast.success(t('Code copied'))
      } catch {
        toast.error(t('Failed to copy code'))
      }
    },
    [t]
  )

  const columns = useMemo<ColumnDef<AgentCode>[]>(
    () => [
      {
        id: 'select',
        header: t('Refund'),
        cell: ({ row, table: currentTable }) => {
          const meta = currentTable.options.meta as AgentCodesTableMeta
          const refundable = isRefundableAgentCode(row.original)
          return (
            <Checkbox
              aria-label={t('Select code for refund')}
              checked={meta.selectedIDs.has(row.original.id)}
              disabled={!refundable}
              onCheckedChange={(checked) =>
                meta.toggleCode(row.original, checked)
              }
            />
          )
        },
      },
      {
        accessorKey: 'code',
        header: t('Code'),
        cell: ({ row, table: currentTable }) => {
          const meta = currentTable.options.meta as AgentCodesTableMeta
          const code = row.original
          if (!code.code_visible || !code.code) {
            return <span className='text-muted-foreground'>{t('Hidden')}</span>
          }
          return (
            <div className='flex max-w-72 items-center gap-1'>
              <code className='min-w-0 truncate text-xs'>{code.code}</code>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={t('Copy code')}
                onClick={() => meta.copyCode(code)}
              >
                <HugeiconsIcon
                  icon={Copy01Icon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
              </Button>
            </div>
          )
        },
      },
      { accessorKey: 'plan_title', header: t('Plan') },
      {
        accessorKey: 'order_no',
        header: t('Order'),
        cell: ({ row }) => (
          <div>
            <div>{row.original.order_no}</div>
            <div className='text-muted-foreground text-xs'>
              {t('Order ID: {{id}}', { id: row.original.order_id })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const status = deriveAgentCodeStatus(
            row.original.status,
            row.original.expired_at
          )
          const labels = {
            unused: t('Unused'),
            used: t('Used'),
            refunded: t('Refunded'),
            expired: t('Expired'),
          }
          const variant = status === 'unused' ? 'secondary' : 'outline'
          return <Badge variant={variant}>{labels[status]}</Badge>
        },
      },
      {
        accessorKey: 'expired_at',
        header: t('Expires'),
        cell: ({ row }) =>
          new Date(row.original.expired_at * 1000).toLocaleString(),
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: codesQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: codesQuery.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
    meta: { selectedIDs, toggleCode, copyCode } satisfies AgentCodesTableMeta,
  })

  const updateFilters = (updates: Partial<AgentWorkspaceSearch>) =>
    props.onSearchChange({ ...updates, p: 1 })

  const downloadCSV = async () => {
    setExportPending(true)
    try {
      const file = await exportAgentCodes({
        plan_id: props.search.plan_id,
        order_id: props.search.order_id,
        status: props.search.code_status,
        start_timestamp: props.search.start_timestamp,
        end_timestamp: props.search.end_timestamp,
      })
      downloadAgentExport(file, {
        createObjectURL: (blob) => URL.createObjectURL(blob),
        revokeObjectURL: (url) => URL.revokeObjectURL(url),
        click: (url, filename) => {
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = filename
          anchor.click()
        },
      })
      toast.success(t('CSV export downloaded'))
    } catch {
      toast.error(t('Failed to export package codes'))
    } finally {
      setExportPending(false)
    }
  }

  return (
    <>
      <AgentTableShell
        table={table}
        isLoading={codesQuery.isPending}
        isFetching={codesQuery.isFetching}
        error={codesQuery.error}
        onRetry={() => codesQuery.refetch()}
        emptyTitle={t('No package codes found')}
        emptyDescription={t(
          'Purchased package codes will appear in this inventory.'
        )}
        page={page}
        pageSize={pageSize}
        total={codesQuery.data?.total ?? 0}
        onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
        filters={
          <>
            <Input
              type='number'
              min={1}
              className='w-32'
              aria-label={t('Filter codes by plan')}
              placeholder={t('Plan ID')}
              value={props.search.plan_id?.toString() ?? ''}
              onChange={(event) =>
                updateFilters({
                  plan_id: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
            <NativeSelect
              aria-label={t('Filter codes by status')}
              value={props.search.code_status ?? ''}
              onChange={(event) =>
                updateFilters({
                  code_status:
                    (event.target
                      .value as AgentWorkspaceSearch['code_status']) ||
                    undefined,
                })
              }
            >
              <NativeSelectOption value=''>
                {t('All statuses')}
              </NativeSelectOption>
              <NativeSelectOption value='unused'>
                {t('Unused')}
              </NativeSelectOption>
              <NativeSelectOption value='used'>{t('Used')}</NativeSelectOption>
              <NativeSelectOption value='refunded'>
                {t('Refunded')}
              </NativeSelectOption>
              <NativeSelectOption value='expired'>
                {t('Expired')}
              </NativeSelectOption>
            </NativeSelect>
            <Input
              type='number'
              min={1}
              className='w-32'
              aria-label={t('Filter by order ID')}
              placeholder={t('Order ID')}
              value={props.search.order_id ?? ''}
              onChange={(event) =>
                updateFilters({
                  order_id: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
            <Input
              type='date'
              aria-label={t('Code start date')}
              className='w-auto'
              value={timestampToLocalDateInput(props.search.start_timestamp)}
              onChange={(event) =>
                updateFilters({
                  start_timestamp: localDateInputToTimestamp(
                    event.target.value
                  ),
                })
              }
            />
            <Input
              type='date'
              aria-label={t('Code end date')}
              className='w-auto'
              value={timestampToLocalDateInput(props.search.end_timestamp)}
              onChange={(event) => {
                const startOfDay = localDateInputToTimestamp(event.target.value)
                updateFilters({
                  end_timestamp: startOfDay ? startOfDay + 86_399 : undefined,
                })
              }}
            />
            <NativeSelect
              aria-label={t('Rows per page')}
              value={pageSize.toString()}
              onChange={(event) =>
                updateFilters({ page_size: Number(event.target.value) })
              }
            >
              {[10, 20, 50, 100].map((size) => (
                <NativeSelectOption key={size} value={size}>
                  {t('{{size}} per page', { size })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </>
        }
        actions={
          <>
            <div className='text-muted-foreground text-xs'>
              {t('{{count}} selected; selection stays across pages.', {
                count: selectedIDs.size,
              })}
            </div>
            <Button
              type='button'
              variant='outline'
              disabled={exportPending}
              onClick={downloadCSV}
            >
              {exportPending ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <HugeiconsIcon
                  icon={Download01Icon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
              )}
              {t('Export CSV')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={selectedIDs.size === 0}
              onClick={() => setRefundOpen(true)}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                strokeWidth={2}
                data-icon='inline-start'
              />
              {t('Refund selected')}
            </Button>
          </>
        }
      />

      <RefundDialog
        redemptionIDs={[...selectedIDs]}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onRefunded={(refundedIDs) => {
          setSelectedIDs((current) => {
            const next = new Set(current)
            refundedIDs.forEach((id) => next.delete(id))
            return next
          })
        }}
      />
    </>
  )
}
