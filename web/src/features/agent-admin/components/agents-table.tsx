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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import {
  disableAgent,
  enableAgent,
  getAdminAgentReconciliation,
  getAdminAgents,
} from '@/features/agents/api'
import { AgentTableShell } from '@/features/agents/components/agent-table-shell'
import type { AdminAgent } from '@/features/agents/types'

import {
  agentAdminQueryKeys,
  getAgentAdminInvalidationPlan,
  type AgentAdminSearch,
} from '../lib/admin'
import { AgentLimitDialog } from './agent-limit-dialog'
import { CreditAdjustmentDialog } from './credit-adjustment-dialog'

type AgentsTableProps = {
  scope: number
  canMutate: boolean
  search: AgentAdminSearch
  onSearchChange: (updates: Partial<AgentAdminSearch>) => void
}

type AgentTableMeta = {
  canMutate: boolean
  openCredit: (agent: AdminAgent) => void
  openLimit: (agent: AdminAgent) => void
  openLifecycle: (agent: AdminAgent) => void
  openReconciliation: (agent: AdminAgent) => void
  openLedger: (agent: AdminAgent) => void
}

export function AgentsTable(props: AgentsTableProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [creditAgent, setCreditAgent] = useState<AdminAgent | null>(null)
  const [limitAgent, setLimitAgent] = useState<AdminAgent | null>(null)
  const [lifecycleAgent, setLifecycleAgent] = useState<AdminAgent | null>(null)
  const [reconciliationAgent, setReconciliationAgent] =
    useState<AdminAgent | null>(null)
  const [enableOpen, setEnableOpen] = useState(false)
  const [enableUserID, setEnableUserID] = useState('')
  const [enableSubmitted, setEnableSubmitted] = useState(false)
  const page = props.search.p
  const agentStatus =
    props.search.status === 'active' || props.search.status === 'disabled'
      ? props.search.status
      : undefined
  const agentsQuery = useQuery({
    queryKey: agentAdminQueryKeys.agents(props.scope, props.search),
    queryFn: async () => {
      const response = await getAdminAgents({
        p: page,
        page_size: 20,
        keyword: props.search.keyword,
        status: agentStatus,
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })

  const lifecycleMutation = useMutation({
    mutationFn: async (agent: AdminAgent) => {
      const response =
        agent.status === 'active'
          ? await disableAgent(agent.user_id)
          : await enableAgent(agent.user_id)
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: async (data) => {
      toast.success(t('Agent status updated'))
      await Promise.all(
        getAgentAdminInvalidationPlan(
          'lifecycle',
          props.scope,
          data.user_id
        ).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
      setLifecycleAgent(null)
    },
    onError: () => toast.error(t('Failed to update agent status')),
  })

  const enableMutation = useMutation({
    mutationFn: async (userID: number) => {
      const response = await enableAgent(userID)
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: async (data) => {
      toast.success(t('Agent enabled'))
      await Promise.all(
        getAgentAdminInvalidationPlan(
          'lifecycle',
          props.scope,
          data.user_id
        ).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
      setEnableOpen(false)
      setEnableUserID('')
      setEnableSubmitted(false)
    },
    onError: () => toast.error(t('Failed to enable agent')),
  })

  const openLifecycle = (agent: AdminAgent) => {
    lifecycleMutation.reset()
    setLifecycleAgent(agent)
  }

  const closeLifecycle = () => {
    if (lifecycleMutation.isPending) return
    lifecycleMutation.reset()
    setLifecycleAgent(null)
  }

  const changeEnableOpen = (open: boolean) => {
    if (enableMutation.isPending) return
    enableMutation.reset()
    setEnableUserID('')
    setEnableSubmitted(false)
    setEnableOpen(open)
  }

  const columns = useMemo<ColumnDef<AdminAgent>[]>(
    () => [
      {
        accessorKey: 'user_id',
        header: t('User'),
        cell: ({ row }) => (
          <div>
            <div className='font-medium'>
              {row.original.display_name ||
                row.original.username ||
                t('User #{{id}}', { id: row.original.user_id })}
            </div>
            <div className='text-muted-foreground text-xs'>
              #{row.original.user_id}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'active' ? 'secondary' : 'outline'}
          >
            {row.original.status === 'active' ? t('Active') : t('Disabled')}
          </Badge>
        ),
      },
      {
        accessorKey: 'balance',
        header: t('Point balance'),
        cell: ({ row }) => (
          <span className='tabular-nums'>{row.original.balance}</span>
        ),
      },
      {
        id: 'daily_usage',
        header: t('Daily usage'),
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.daily_code_count} / {row.original.daily_code_limit}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: ({ row, table: currentTable }) => {
          const meta = currentTable.options.meta as AgentTableMeta
          return (
            <div className='flex flex-wrap gap-1'>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => meta.openReconciliation(row.original)}
              >
                {t('Reconcile')}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => meta.openLedger(row.original)}
              >
                {t('Ledger')}
              </Button>
              {meta.canMutate && (
                <>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => meta.openCredit(row.original)}
                  >
                    {t('Balance')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => meta.openLimit(row.original)}
                  >
                    {t('Limit')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant={
                      row.original.status === 'active'
                        ? 'destructive'
                        : 'outline'
                    }
                    onClick={() => meta.openLifecycle(row.original)}
                  >
                    {row.original.status === 'active'
                      ? t('Disable')
                      : t('Enable')}
                  </Button>
                </>
              )}
            </div>
          )
        },
      },
    ],
    [t]
  )

  const table = useReactTable({
    data: agentsQuery.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: agentsQuery.data?.total ?? 0,
    getRowId: (row) => row.user_id.toString(),
    meta: {
      canMutate: props.canMutate,
      openCredit: setCreditAgent,
      openLimit: setLimitAgent,
      openLifecycle,
      openReconciliation: setReconciliationAgent,
      openLedger: (agent) =>
        props.onSearchChange({
          tab: 'ledger',
          agent_user_id: agent.user_id,
          p: 1,
          keyword: undefined,
          plan_id: undefined,
          order_id: undefined,
          status: undefined,
        }),
    } satisfies AgentTableMeta,
  })

  const reconciliationQuery = useQuery({
    queryKey: agentAdminQueryKeys.reconciliation(
      props.scope,
      reconciliationAgent?.user_id ?? 0
    ),
    queryFn: async () => {
      if (!reconciliationAgent) throw new Error('Missing agent')
      const response = await getAdminAgentReconciliation(
        reconciliationAgent.user_id
      )
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    enabled: Boolean(reconciliationAgent),
  })

  const validEnableUserID =
    /^\d+$/.test(enableUserID) &&
    Number(enableUserID) > 0 &&
    Number.isSafeInteger(Number(enableUserID))

  return (
    <>
      <AgentTableShell
        table={table}
        isLoading={agentsQuery.isPending}
        isFetching={agentsQuery.isFetching}
        error={agentsQuery.error}
        onRetry={() => agentsQuery.refetch()}
        emptyTitle={t('No agents found')}
        emptyDescription={t(
          'Enable a user as an agent to create the first agent account.'
        )}
        page={page}
        pageSize={20}
        total={agentsQuery.data?.total ?? 0}
        onPageChange={(nextPage) => props.onSearchChange({ p: nextPage })}
        filters={
          <>
            <Input
              className='w-64'
              aria-label={t('Search agents')}
              placeholder={t('Search user ID, username, or display name')}
              value={props.search.keyword ?? ''}
              onChange={(event) =>
                props.onSearchChange({
                  keyword: event.target.value || undefined,
                  p: 1,
                })
              }
            />
            <NativeSelect
              aria-label={t('Filter agents by status')}
              value={agentStatus ?? ''}
              onChange={(event) =>
                props.onSearchChange({
                  status:
                    (event.target.value as 'active' | 'disabled') || undefined,
                  p: 1,
                })
              }
            >
              <NativeSelectOption value=''>
                {t('All statuses')}
              </NativeSelectOption>
              <NativeSelectOption value='active'>
                {t('Active')}
              </NativeSelectOption>
              <NativeSelectOption value='disabled'>
                {t('Disabled')}
              </NativeSelectOption>
            </NativeSelect>
          </>
        }
        actions={
          props.canMutate ? (
            <Button type='button' onClick={() => changeEnableOpen(true)}>
              {t('Enable user as agent')}
            </Button>
          ) : undefined
        }
      />

      {creditAgent && (
        <CreditAdjustmentDialog
          key={creditAgent.user_id}
          agent={creditAgent}
          scope={props.scope}
          open
          onOpenChange={(open) => !open && setCreditAgent(null)}
        />
      )}
      {limitAgent && (
        <AgentLimitDialog
          key={limitAgent.user_id}
          agent={limitAgent}
          scope={props.scope}
          open
          onOpenChange={(open) => !open && setLimitAgent(null)}
        />
      )}

      <Dialog
        open={Boolean(lifecycleAgent)}
        onOpenChange={(open) => !open && closeLifecycle()}
      >
        <DialogContent
          className='sm:max-w-md'
          showCloseButton={!lifecycleMutation.isPending}
        >
          <DialogHeader>
            <DialogTitle>
              {lifecycleAgent?.status === 'active'
                ? t('Disable agent')
                : t('Enable agent')}
            </DialogTitle>
            <DialogDescription>
              {lifecycleAgent?.status === 'active'
                ? t(
                    'Disabling blocks new purchases and hides fresh unused code values from the agent.'
                  )
                : t(
                    'Enabling restores the agent workspace and package-code purchases.'
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={lifecycleMutation.isPending}
              onClick={closeLifecycle}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              variant={
                lifecycleAgent?.status === 'active' ? 'destructive' : 'default'
              }
              disabled={!lifecycleAgent || lifecycleMutation.isPending}
              onClick={() =>
                lifecycleAgent && lifecycleMutation.mutate(lifecycleAgent)
              }
            >
              {lifecycleMutation.isPending && (
                <Spinner data-icon='inline-start' />
              )}
              {lifecycleMutation.isError
                ? t('Retry status change')
                : t('Confirm status change')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={enableOpen} onOpenChange={changeEnableOpen}>
        <DialogContent
          className='sm:max-w-md'
          showCloseButton={!enableMutation.isPending}
        >
          <DialogHeader>
            <DialogTitle>{t('Enable user as agent')}</DialogTitle>
            <DialogDescription>
              {t(
                'Enter an existing user ID. A new agent account starts with zero points.'
              )}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={enableSubmitted && !validEnableUserID}>
              <FieldLabel htmlFor='enable-agent-user-id'>
                {t('User ID')}
              </FieldLabel>
              <Input
                id='enable-agent-user-id'
                type='number'
                min={1}
                step={1}
                value={enableUserID}
                aria-invalid={enableSubmitted && !validEnableUserID}
                onChange={(event) => setEnableUserID(event.target.value)}
              />
              <FieldError>
                {enableSubmitted && !validEnableUserID
                  ? t('Enter a valid positive user ID.')
                  : null}
              </FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={enableMutation.isPending}
              onClick={() => changeEnableOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={enableMutation.isPending}
              onClick={() => {
                setEnableSubmitted(true)
                if (validEnableUserID) {
                  enableMutation.mutate(Number(enableUserID))
                }
              }}
            >
              {enableMutation.isPending && <Spinner data-icon='inline-start' />}
              {enableMutation.isError ? t('Retry enable') : t('Enable agent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reconciliationAgent)}
        onOpenChange={(open) => !open && setReconciliationAgent(null)}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Agent reconciliation')}</DialogTitle>
            <DialogDescription>
              {t(
                'Compare the stored balance with the immutable ledger total for user #{{id}}.',
                { id: reconciliationAgent?.user_id }
              )}
            </DialogDescription>
          </DialogHeader>
          {reconciliationQuery.isPending && (
            <div className='flex min-h-32 items-center justify-center'>
              <Spinner aria-label={t('Loading reconciliation')} />
            </div>
          )}
          {!reconciliationQuery.isPending &&
            (reconciliationQuery.isError || !reconciliationQuery.data) && (
              <div className='flex flex-col items-start gap-3'>
                <p className='text-destructive text-sm'>
                  {t('Failed to load reconciliation.')}
                </p>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => reconciliationQuery.refetch()}
                >
                  {t('Retry')}
                </Button>
              </div>
            )}
          {!reconciliationQuery.isPending &&
            !reconciliationQuery.isError &&
            reconciliationQuery.data && (
              <div
                className='grid gap-3 rounded-xl border p-4 sm:grid-cols-2'
                aria-live='polite'
              >
                <div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Stored balance')}
                  </div>
                  <div className='font-semibold tabular-nums'>
                    {reconciliationQuery.data.balance}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Ledger total')}
                  </div>
                  <div className='font-semibold tabular-nums'>
                    {reconciliationQuery.data.ledger_sum}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Difference')}
                  </div>
                  <div className='font-semibold tabular-nums'>
                    {reconciliationQuery.data.difference}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Result')}
                  </div>
                  <Badge
                    variant={
                      reconciliationQuery.data.matches &&
                      reconciliationQuery.data.ledger_continuous
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {reconciliationQuery.data.matches &&
                    reconciliationQuery.data.ledger_continuous
                      ? t('Matched')
                      : t('Mismatch')}
                  </Badge>
                </div>
              </div>
            )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setReconciliationAgent(null)}
            >
              {t('Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
