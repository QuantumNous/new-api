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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { getServerErrorMessage, getServerErrorStatus, isServerErrorCancelled, requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import {
  GroupMigrationHistory,
  type MigrationOperation,
} from './group-migration-history'
import {
  createGroupMigrationSchema,
  type GroupMigrationNames,
} from '../lib/group-migration-schema'

type MigrationCoordination = {
  ready: boolean
  reason: string
  nodes: { name: string; phase: string; revision: number }[]
}

type GroupMigrationPreview = {
  source: string
  target: string
  version: string
  counts: Record<string, { records: number; references: number }>
  unfinished_tasks: number
  blockers: string[]
  warnings: string[]
  execution_blockers: string[]
  confirmation: string
  expires_at: number
  coordination?: MigrationCoordination
}

export function GroupMigrationEntry(props: { groups: readonly string[] }) {
  const { t } = useTranslation()
  const isRoot = useAuthStore((state) => (state.auth.user?.role ?? 0) >= 100)
  const [open, setOpen] = useState(false)
  const [confirmSaved, setConfirmSaved] = useState(false)
  if (!isRoot) return null
  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => setConfirmSaved(true)}
      >
        {t('Group migration')}
      </Button>
      <ConfirmDialog
        open={confirmSaved}
        onOpenChange={setConfirmSaved}
        title={t('Confirm group migration')}
        desc={t('Make sure group settings are saved before continuing.')}
        confirmText={t('Continue')}
        handleConfirm={() => {
          setConfirmSaved(false)
          setOpen(true)
        }}
      />
      {open && (
        <GroupMigrationDialog
          groups={props.groups}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function GroupMigrationDialog(props: {
  groups: readonly string[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState<GroupMigrationPreview>()
  const [submission, setSubmission] = useState<
    GroupMigrationPreview & { operation_id: string }
  >()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [observed, setObserved] = useState<MigrationOperation>()
  const operations = useQuery({
    queryKey: ['group-migration', 'operations'],
    queryFn: async ({ signal }) => {
      const response = await api.get<{
        success: boolean
        data: MigrationOperation[]
      }>('/api/option/group_migration', { signal, skipErrorHandler: true })
      return requireServerSuccess(response.data).data
    },
    refetchInterval: (query) =>
      query.state.data?.some(
        (operation) =>
          operation.state === 'paused' || operation.state === 'committed'
      )
        ? 2000
        : false,
    retry: false,
    meta: { errorToast: false },
  })
  const execution = useMutation({
    meta: { errorToast: false },
    mutationFn: async (
      request:
        | { preview: GroupMigrationPreview & { operation_id: string } }
        | { resume: string }
    ) => {
      let response
      if ('resume' in request) {
        response = await api.post<{
          success: boolean
          data: MigrationOperation
        }>(
          `/api/option/group_migration/${encodeURIComponent(request.resume)}/resume`,
          undefined,
          { skipErrorHandler: true }
        )
      } else {
        response = await api.post<{
          success: boolean
          data: MigrationOperation
        }>(
          '/api/option/group_migration',
          {
            operation_id: request.preview.operation_id,
            source: request.preview.source,
            target: request.preview.target,
            version: request.preview.version,
            confirmation: request.preview.confirmation,
          },
          { skipErrorHandler: true }
        )
      }
      return requireServerSuccess(response.data).data
    },
    onSuccess: (operation) => {
      setObserved(operation)
      setConfirmation(undefined)
      if (operation.state === 'aborted') preview.reset()
      if (operation.state === 'completed') {
        void client.invalidateQueries({
          queryKey: ['group-migration', 'groups'],
        })
        void client.invalidateQueries({ queryKey: ['system-options'] })
      }
      void operations.refetch()
    },
    onError: () => {
      void operations.refetch()
    },
  })
  const historyOperations =
    observed &&
    !(operations.data ?? []).some((operation) => operation.id === observed.id)
      ? [observed, ...(operations.data ?? [])]
      : (operations.data ?? [])
  const operationsCancelled =
    operations.isError && isServerErrorCancelled(operations.error)
  const historyLoading = operations.isFetching && historyOperations.length === 0
  const historyError = operations.isError && !operationsCancelled
  const active = historyOperations.find(
    (op) => op.state === 'paused' || op.state === 'committed'
  )
  const verifyStatus = async (operationId: string) => {
    const refreshed = await operations.refetch()
    if (!refreshed.isSuccess) return undefined
    return {
      operation: refreshed.data?.find((item) => item.id === operationId),
      checkedAt: Date.now(),
    }
  }
  const states = {
    paused: t('Migration paused before commit'),
    committed: t('Database committed; synchronization pending'),
    completed: t('Migration completed'),
    aborted: t('Migration aborted; preview and confirm again'),
  }
  const form = useForm<GroupMigrationNames>({
    resolver: zodResolver(createGroupMigrationSchema(t)),
    defaultValues: { source: '', target: '' },
  })
  const source = form.watch('source')
  const target = form.watch('target')
  const groups = useQuery({
    queryKey: ['group-migration', 'groups'],
    queryFn: async ({ signal }) => {
      const response = await api.get<{ success: boolean; data: string[] }>(
        '/api/group/',
        { signal, skipErrorHandler: true }
      )
      return requireServerSuccess(response.data).data
    },
    initialData: [...props.groups],
    staleTime: 0,
    retry: false,
    meta: { errorToast: false },
  })
  const preview = useMutation({
    meta: { errorToast: false },
    mutationFn: async (names: GroupMigrationNames) => {
      const response = await api.get<{
        success: boolean
        data: GroupMigrationPreview
      }>('/api/option/group_migration/preview', {
        params: names,
        skipErrorHandler: true,
      })
      return requireServerSuccess(response.data).data
    },
    onSuccess: () => setSubmission(undefined),
  })
  // A pending result belongs to its submitted names, never the current draft.
  const result =
    preview.data?.source === source && preview.data.target === target
      ? preview.data
      : undefined
  const groupListUnavailable = groups.isError && groups.data === undefined
  const error =
    groupListUnavailable ||
    (preview.isError &&
      preview.variables?.source === source &&
      preview.variables.target === target)
  const inspectionError = groupListUnavailable ? groups.error : preview.error
  const inspectionErrorStatus = getServerErrorStatus(inspectionError)
  let inspectionErrorMessage = t(
    'Unable to inspect group references. Please try again.'
  )
  if (inspectionErrorStatus === 401) {
    inspectionErrorMessage = t('Session expired!')
  } else if (inspectionErrorStatus) {
    inspectionErrorMessage = getServerErrorMessage(
      inspectionError,
      inspectionErrorMessage
    )
  }
  const blockers = [
    ...(result?.blockers ?? []),
    ...(result?.execution_blockers ?? []),
  ]
  const coordination =
    active?.coordination ?? result?.coordination
  const phases: Record<string, string> = {
    ready: t('Ready'),
    draining: t('Draining requests'),
    drained: t('Requests drained'),
    synced: t('Configuration synchronized'),
  }
  const categories = {
    users: t('Users'),
    tokens: t('Tokens'),
    channels: t('Channels'),
    abilities: t('Routing abilities'),
    subscription_plans: t('Subscription plans'),
    subscriptions: t('Subscriptions'),
    configuration: t('Effective configuration'),
    saved_configuration: t('Saved configuration'),
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Group migration')}
      description={t(
        'Preview group references, then confirm migration. Related requests briefly pause during migration.'
      )}
    >
      <Button
        type='button'
        variant='outline'
        size='sm'
        aria-expanded={historyOpen}
        onClick={() => {
          const nextOpen = !historyOpen
          setHistoryOpen(nextOpen)
          if (
            nextOpen &&
            !operations.isFetching &&
            (operations.isError || operations.data === undefined)
          ) {
            void operations.refetch()
          }
        }}
      >
        <History className='mr-2 size-4' aria-hidden='true' />
        {historyOpen ? t('Hide migration history') : t('View migration history')}
      </Button>
      {active && (
        <section className='mb-4 flex flex-col gap-2' aria-live='polite'>
          <p className='text-sm break-all'>
            {active.id}: {active.source} → {active.target}
          </p>
          <p>{states[active.state]}</p>
          {active.reason && <p>{t(active.reason)}</p>}
        </section>
      )}
      {active && (
        <Button
          type='button'
          disabled={execution.isPending}
          onClick={() => execution.mutate({ resume: active.id })}
        >
          {t('Resume migration')}
        </Button>
      )}
      {historyOpen && (
        <GroupMigrationHistory
          operations={historyOperations}
          isLoading={historyLoading}
          isError={historyError}
          errorMessage={getServerErrorMessage(
            operations.error,
            t('Unable to load migration status. Please retry.')
          )}
          onRetry={() => void operations.refetch()}
          onVerifyStatus={verifyStatus}
        />
      )}
      {execution.isError && !isServerErrorCancelled(execution.error) && (
        <ErrorState
          className='min-h-0'
          title={getServerErrorMessage(
            execution.error,
            t(
              'Unable to execute group migration. Check operation status before retrying.'
            )
          )}
          onRetry={() => void operations.refetch()}
        />
      )}
      {coordination && (
        <section className='my-4 flex flex-col gap-2' aria-live='polite'>
          <p>
            {coordination.ready
              ? t('Deployment coordination ready')
              : t('Deployment coordination unavailable')}
          </p>
          {coordination.reason && (
            <p className='text-destructive'>{t(coordination.reason)}</p>
          )}
          {coordination.nodes.length > 0 && (
            <Table aria-label={t('Migration participants')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Node')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Configuration revision')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coordination.nodes.map((node) => (
                  <TableRow key={node.name}>
                    <TableCell className='break-all'>{node.name}</TableCell>
                    <TableCell>{phases[node.phase] ?? t('Waiting')}</TableCell>
                    <TableCell>{formatNumber(node.revision, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
      <Form {...form}>
        <form
          className='flex flex-col gap-4'
          noValidate
          onSubmit={form.handleSubmit((names) => preview.mutate(names))}
        >
          <FormField
            control={form.control}
            name='source'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Source group')}</FormLabel>
                <FormControl>
                  <NativeSelect
                    {...field}
                    required
                    disabled={groups.data === undefined}
                  >
                    <NativeSelectOption value=''>
                      {t('Select a group')}
                    </NativeSelectOption>
                    {(groups.data ?? [])
                      .filter(
                        (group) => group !== 'default' && group !== 'auto'
                      )
                      .sort()
                      .map((group) => (
                        <NativeSelectOption key={group} value={group}>
                          {group}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='target'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Target group name')}</FormLabel>
                <FormControl>
                  <Input {...field} required autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {groups.data === undefined && groups.isPending && (
            <div role='status'>
              <LoadingState inline message={t('Loading...')} />
            </div>
          )}
          {groups.data !== undefined &&
            !(groups.data ?? []).some(
              (group) => group !== 'default' && group !== 'auto'
            ) && (
              <EmptyState
                className='min-h-0'
                title={t('No groups are available for migration.')}
              />
            )}
          {error && (
            <div role='alert'>
              <ErrorState
                className='min-h-0'
                title={inspectionErrorMessage}
                onRetry={() => {
                  if (groupListUnavailable) {
                    void groups.refetch()
                  } else if (preview.variables) {
                    preview.mutate(preview.variables)
                  }
                }}
              />
            </div>
          )}
          <Button
            type='submit'
            disabled={
              !source ||
              !target ||
              preview.isPending ||
              groups.data === undefined
            }
          >
            {preview.isPending ? t('Loading...') : t('Preview impact')}
          </Button>
        </form>
      </Form>
      {result && (
        <section className='mt-4 flex flex-col gap-3' aria-live='polite'>
          <p className='text-sm'>
            {result.source} → {result.target}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Resource')}</TableHead>
                <TableHead>{t('Records')}</TableHead>
                <TableHead>{t('References')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(categories).map(([key, label]) => (
                <TableRow key={key}>
                  <TableCell>{label}</TableCell>
                  <TableCell>
                    {formatNumber(result.counts[key]?.records ?? 0, locale)}
                  </TableCell>
                  <TableCell>
                    {formatNumber(result.counts[key]?.references ?? 0, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Configuration rows count effective settings and saved options separately.'
            )}
          </p>
          <p>
            {t('Related unfinished tasks')}:{' '}
            {formatNumber(result.unfinished_tasks, locale)}
          </p>
          {blockers.length === 0 ? (
            <p>
              {t('No blocking conditions found. Review and confirm migration.')}
            </p>
          ) : (
            <ul className='text-destructive flex list-disc flex-col gap-1 pl-5'>
              {blockers.map((message) => (
                <li key={message}>{t(message)}</li>
              ))}
            </ul>
          )}
          <ul className='text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm'>
            {result.warnings.map((message) => (
              <li key={message}>{t(message)}</li>
            ))}
          </ul>
          <p className='text-muted-foreground text-xs break-all'>
            {t('Preview version')}: <span>{result.version}</span>
          </p>
        </section>
      )}
      <div className='mt-4 flex flex-wrap justify-end gap-2'>
        <Button type='button' variant='outline' onClick={props.onClose}>
          {t('Close')}
        </Button>
        <Button
          type='button'
          disabled={
            !result ||
            blockers.length > 0 ||
            coordination?.ready === false
          }
          onClick={() => setConfirmation(result)}
        >
          {t('Migrate group')}
        </Button>
      </div>
      <ConfirmDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(undefined)
        }}
        title={t('Confirm group migration')}
        desc={
          <p>
            {confirmation?.source} → {confirmation?.target}.{' '}
            {t(
              'Related requests briefly pause. External scripts must use the new group name.'
            )}
          </p>
        }
        confirmText={t('Confirm migration')}
        isLoading={execution.isPending}
        handleConfirm={() => {
          if (!confirmation) return
          const pending =
            submission?.version === confirmation.version &&
            submission.source === confirmation.source &&
            submission.target === confirmation.target
              ? submission
              : { ...confirmation, operation_id: crypto.randomUUID() }
          setSubmission(pending)
          execution.mutate({ preview: pending })
        }}
      />
    </Dialog>
  )
}
