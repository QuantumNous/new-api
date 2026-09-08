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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import {
  getAdminAgentCodes,
  refundAdminAgentCodes,
} from '@/features/agents/api'
import { AgentTableShell } from '@/features/agents/components/agent-table-shell'
import { deriveAgentCodeStatus } from '@/features/agents/lib/money'
import {
  AgentIdempotencyKeyStore,
  isRefundableAgentCode,
} from '@/features/agents/lib/workspace'
import type { AgentCode, AgentRefundResponse } from '@/features/agents/types'

import {
  agentAdminQueryKeys,
  getAdminRefundSelection,
  getAgentAdminInvalidationPlan,
  type AgentAdminSearch,
} from '../lib/admin'

type AgentCodesTableProps = {
  scope: number
  canMutate: boolean
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

type CodeTableMeta = {
  selected: ReadonlyMap<number, AgentCode>
  canSelect: (code: AgentCode) => boolean
  toggle: (code: AgentCode, checked: boolean) => void
}

export function AgentCodesTable(props: AgentCodesTableProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Map<number, AgentCode>>(new Map())
  const [refundOpen, setRefundOpen] = useState(false)
  const codeStatus =
    props.search.status === 'unused' ||
    props.search.status === 'used' ||
    props.search.status === 'refunded' ||
    props.search.status === 'expired'
      ? props.search.status
      : undefined
  const query = useQuery({
    queryKey: agentAdminQueryKeys.codes(props.scope, props.search),
    queryFn: async () => {
      const response = await getAdminAgentCodes({
        p: props.search.p,
        page_size: 20,
        agent_user_id: props.search.agent_user_id,
        plan_id: props.search.plan_id,
        order_id: props.search.order_id,
        status: codeStatus,
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })
  const refundableSelection = new Map(
    [...selected].filter(([, code]) => isRefundableAgentCode(code))
  )
  const selectedAgentID = refundableSelection.values().next().value
    ?.agent_user_id as number | undefined
  const canSelect = useCallback(
    (code: AgentCode) =>
      props.canMutate &&
      isRefundableAgentCode(code) &&
      (selectedAgentID === undefined || selectedAgentID === code.agent_user_id),
    [props.canMutate, selectedAgentID]
  )
  const toggle = useCallback(
    (code: AgentCode, checked: boolean) => {
      setSelected((current) => {
        const next = new Map(
          [...current].filter(([, candidate]) =>
            isRefundableAgentCode(candidate)
          )
        )
        if (!checked) {
          next.delete(code.id)
          return next
        }
        const currentAgentID = next.values().next().value?.agent_user_id as
          | number
          | undefined
        if (
          !isRefundableAgentCode(code) ||
          (currentAgentID !== undefined &&
            currentAgentID !== code.agent_user_id)
        ) {
          toast.error(t('Select unused codes belonging to one agent only.'))
          return current
        }
        if (next.size >= 100) {
          toast.error(t('You can select at most 100 codes for one refund.'))
          return current
        }
        next.set(code.id, code)
        return next
      })
    },
    [t]
  )
  const columns = useMemo<ColumnDef<AgentCode>[]>(
    () => [
      ...(props.canMutate
        ? [
            {
              id: 'select',
              header: t('Special refund'),
              cell: ({
                row,
                table: currentTable,
              }: {
                row: { original: AgentCode }
                table: { options: { meta?: unknown } }
              }) => {
                const meta = currentTable.options.meta as CodeTableMeta
                return (
                  <Checkbox
                    aria-label={t('Select code for special refund')}
                    checked={meta.selected.has(row.original.id)}
                    disabled={!meta.canSelect(row.original)}
                    onCheckedChange={(value) =>
                      meta.toggle(row.original, value === true)
                    }
                  />
                )
              },
            } satisfies ColumnDef<AgentCode>,
          ]
        : []),
      {
        accessorKey: 'code',
        header: t('Code'),
        cell: ({ row }) =>
          row.original.code_visible && row.original.code ? (
            <code className='block max-w-64 truncate text-xs'>
              {row.original.code}
            </code>
          ) : (
            <span className='text-muted-foreground'>{t('Hidden')}</span>
          ),
      },
      { accessorKey: 'agent_user_id', header: t('Agent user ID') },
      {
        accessorKey: 'order_no',
        header: t('Order'),
        cell: ({ row }) => (
          <div>
            <div>{row.original.order_no}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.order_id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'plan_title',
        header: t('Plan'),
        cell: ({ row }) => (
          <div>
            <div>{row.original.plan_title}</div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.plan_id}
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
          return (
            <Badge variant={status === 'unused' ? 'secondary' : 'outline'}>
              {labels[status]}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'expired_at',
        header: t('Expires'),
        cell: ({ row }) =>
          new Date(row.original.expired_at * 1000).toLocaleString(),
      },
    ],
    [props.canMutate, t]
  )
  const table = useReactTable({
    data: query.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: query.data?.total ?? 0,
    getRowId: (row) => row.id.toString(),
    meta: {
      selected: refundableSelection,
      canSelect,
      toggle,
    } satisfies CodeTableMeta,
  })
  const changeFilters = (updates: Partial<AgentAdminSearch>) => {
    setSelected(new Map())
    props.onSearchChange({ ...updates, p: 1 })
  }
  const numericFilter = (
    key: 'agent_user_id' | 'plan_id' | 'order_id',
    value: string
  ) => changeFilters({ [key]: value ? Number(value) : undefined })

  return (
    <>
      <AgentTableShell
        table={table}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle={t('No package codes found')}
        emptyDescription={t('Agent-owned package codes will appear here.')}
        page={props.search.p}
        pageSize={20}
        total={query.data?.total ?? 0}
        onPageChange={(p) => {
          setSelected(new Map())
          props.onSearchChange({ p })
        }}
        filters={
          <>
            <Input
              type='number'
              min={1}
              className='w-36'
              aria-label={t('Filter by agent user ID')}
              placeholder={t('Agent user ID')}
              value={props.search.agent_user_id ?? ''}
              onChange={(event) =>
                numericFilter('agent_user_id', event.target.value)
              }
            />
            <Input
              type='number'
              min={1}
              className='w-28'
              aria-label={t('Filter by plan ID')}
              placeholder={t('Plan ID')}
              value={props.search.plan_id ?? ''}
              onChange={(event) => numericFilter('plan_id', event.target.value)}
            />
            <Input
              type='number'
              min={1}
              className='w-28'
              aria-label={t('Filter by order ID')}
              placeholder={t('Order ID')}
              value={props.search.order_id ?? ''}
              onChange={(event) =>
                numericFilter('order_id', event.target.value)
              }
            />
            <NativeSelect
              aria-label={t('Filter codes by status')}
              value={codeStatus ?? ''}
              onChange={(event) =>
                changeFilters({
                  status:
                    (event.target.value as typeof codeStatus) || undefined,
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
          </>
        }
        actions={
          props.canMutate ? (
            <Button
              type='button'
              variant='destructive'
              disabled={refundableSelection.size === 0}
              onClick={() => setRefundOpen(true)}
            >
              {t('Special refund ({{count}})', {
                count: refundableSelection.size,
              })}
            </Button>
          ) : undefined
        }
      />
      <SpecialRefundDialog
        scope={props.scope}
        selection={[...refundableSelection.values()]}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onRefunded={(ids) =>
          setSelected((current) => {
            const next = new Map(current)
            ids.forEach((id) => next.delete(id))
            return next
          })
        }
      />
    </>
  )
}

type SpecialRefundDialogProps = {
  scope: number
  selection: AgentCode[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefunded: (ids: number[]) => void
}

type RefundSubmission = NonNullable<ReturnType<typeof getAdminRefundSelection>>

function SpecialRefundDialog(props: SpecialRefundDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const keyStore = useRef(new AgentIdempotencyKeyStore())
  const [result, setResult] = useState<AgentRefundResponse | null>(null)
  const [submittedSelection, setSubmittedSelection] =
    useState<RefundSubmission | null>(null)
  const currentRefundSelection = getAdminRefundSelection(props.selection)
  const displaySelection = submittedSelection ?? currentRefundSelection
  const mutation = useMutation({
    mutationFn: async () => {
      const submission = getAdminRefundSelection(
        props.selection,
        Math.floor(Date.now() / 1000)
      )
      if (!submission) throw new Error('Invalid refund selection')
      const immutableSubmission: RefundSubmission = {
        agentUserID: submission.agentUserID,
        redemptionIDs: [...submission.redemptionIDs],
      }
      setSubmittedSelection(immutableSubmission)
      const redemptionIDs = [...immutableSubmission.redemptionIDs].sort(
        (left, right) => left - right
      )
      const response = await refundAdminAgentCodes({
        agent_user_id: immutableSubmission.agentUserID,
        redemption_ids: redemptionIDs,
        idempotency_key: keyStore.current.keyFor(
          `${immutableSubmission.agentUserID}:${redemptionIDs.join(',')}`
        ),
      })
      if (!response.success) throw new Error(response.message)
      return { result: response.data, submission: immutableSubmission }
    },
    onSuccess: async (data) => {
      keyStore.current.complete()
      setResult(data.result)
      props.onRefunded(data.result.redemption_ids)
      toast.success(t('Special refund completed'))
      await Promise.all(
        getAgentAdminInvalidationPlan(
          'refund',
          props.scope,
          data.submission.agentUserID
        ).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
    },
    onError: () => toast.error(t('Failed to refund selected package codes')),
  })
  const close = (open: boolean) => {
    if (mutation.isPending) return
    if (!open) {
      mutation.reset()
      keyStore.current.complete()
      setResult(null)
      setSubmittedSelection(null)
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent
        className='sm:max-w-lg'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Special refund')}</DialogTitle>
          <DialogDescription>
            {t(
              'Refund {{count}} selected unused codes for agent user #{{id}}. The server applies the saved order terms.',
              {
                count: displaySelection?.redemptionIDs.length ?? 0,
                id: displaySelection?.agentUserID ?? 0,
              }
            )}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div
            className='grid gap-3 rounded-xl border p-4 sm:grid-cols-3'
            aria-live='polite'
          >
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Server refund fee')}
              </div>
              <div className='font-semibold tabular-nums'>{result.fee}</div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Server refunded points')}
              </div>
              <div className='font-semibold tabular-nums'>
                {result.refunded}
              </div>
            </div>
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Server balance after refund')}
              </div>
              <div className='font-semibold tabular-nums'>
                {result.balance_after}
              </div>
            </div>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t(
              'No refund estimate is calculated in the browser. Fee, refund, and balance are shown only from the completed server result.'
            )}
          </p>
        )}
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={() => close(false)}
          >
            {result ? t('Done') : t('Cancel')}
          </Button>
          {!result && (
            <Button
              type='button'
              variant='destructive'
              disabled={!currentRefundSelection || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Spinner data-icon='inline-start' />}
              {mutation.isError
                ? t('Retry special refund')
                : t('Confirm special refund')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
