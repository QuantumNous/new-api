/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  TruncatedCell,
  useDataTable,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { toIntlLocale } from '@/i18n/languages'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  AUTHORIZATION_LOG_ACTIONS,
  listPartnerOAuthAuthorizationLogs,
  type AuthorizationLog,
  type AuthorizationLogFilters,
} from './authorization-log-api'

const EMPTY_LOGS: AuthorizationLog[] = []
const DEFAULT_FILTERS: AuthorizationLogFilters = { page: 1, page_size: 20 }

export function PartnerOAuthAuthorizationLogs() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const sessionId = useAuthStore((state) => state.auth.session?.sid)
  const accessToken = useAuthStore((state) => state.auth.accessToken)
  const canRead =
    !!user &&
    !!sessionId &&
    !!accessToken &&
    user.role >= ROLE.ADMIN &&
    hasPermission(
      user,
      ADMIN_PERMISSION_RESOURCES.PARTNER_OAUTH_CLIENT,
      ADMIN_PERMISSION_ACTIONS.READ
    )
  const [draft, setDraft] = useState({
    action: '',
    success: '',
    clientId: '',
    targetUserId: '',
    start: undefined as number | undefined,
    end: undefined as number | undefined,
  })
  const [filters, setFilters] =
    useState<AuthorizationLogFilters>(DEFAULT_FILTERS)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const invalidClient =
    !!draft.clientId && !/^pc_[0-9a-f]{32}$/.test(draft.clientId.trim())
  const invalidUser =
    !!draft.targetUserId &&
    (!/^[1-9]\d*$/.test(draft.targetUserId.trim()) ||
      !Number.isSafeInteger(Number(draft.targetUserId.trim())))
  const invalidRange =
    draft.start !== undefined &&
    draft.end !== undefined &&
    draft.start > draft.end
  const invalidFilters = invalidClient || invalidUser || invalidRange
  const query = useQuery({
    queryKey: [
      'admin',
      'partner-oauth-authorization-logs',
      user?.id,
      sessionId,
      filters,
    ],
    queryFn: () => listPartnerOAuthAuthorizationLogs(filters),
    enabled: canRead,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    retry: false,
    meta: { errorToast: false },
  })
  const actionNames = useMemo<Record<string, string>>(
    () => ({
      'partner_oauth.consent.approve': t('Consent approved'),
      'partner_oauth.consent.deny': t('Consent denied'),
      'partner_oauth.token.issue': t('Token issued'),
      'partner_oauth.code.replay_detected': t('Authorization code replay'),
      'partner_oauth.refresh.reuse_detected': t('Refresh token replay'),
      'partner_oauth.binding.revoke': t('Binding revoked'),
      'partner_oauth.binding.admin_revoke': t('Binding revoked by admin'),
      'partner_oauth.binding.client_delete': t(
        'Client deletion revoked binding'
      ),
      'partner_oauth.credential.issue': t('Credential issued'),
      'partner_oauth.payment.order_create': t('Payment order created'),
      'partner_server.token_issue': t('Server token issued'),
      'partner_server.token_issue_failed': t('Server token refused'),
      'partner_server.auth_denied': t('Server request refused'),
      'partner_server.secret_issue': t('Server secret issued'),
      'partner_server.secret_revoke': t('Server secret revoked'),
      'partner_server.suspend': t('Partner suspended'),
      'partner_server.resume': t('Partner resumed'),
      'partner_server.keys_revoke_all': t('All sub-account keys revoked'),
      'partner_account.create': t('Sub-account created'),
      'partner_account.credential_issue': t('Sub-account key issued'),
      'partner_account.credential_rotate': t('Sub-account key rotated'),
      'partner_account.credential_rate_limited': t('Key requests rate limited'),
      'partner_account.disable': t('Sub-account disabled'),
      'partner_account.enable': t('Sub-account enabled'),
      'partner_account.payment_order_create': t(
        'Sub-account payment order created'
      ),
    }),
    [t]
  )
  const columns = useMemo<ColumnDef<AuthorizationLog>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => formatTimestamp(row.original.created_at),
        meta: { label: t('Time'), mobileTitle: true },
      },
      {
        accessorKey: 'action',
        header: t('Event'),
        cell: ({ row }) =>
          actionNames[row.original.action] ?? row.original.action,
        meta: { label: t('Event') },
      },
      {
        accessorKey: 'success',
        header: t('Result'),
        cell: ({ row }) => (row.original.success ? t('Success') : t('Failed')),
        meta: { label: t('Result') },
      },
      {
        accessorKey: 'reason',
        header: t('Reason'),
        cell: ({ row }) => row.original.reason || '—',
        meta: { label: t('Reason') },
      },
      {
        accessorKey: 'client_id',
        header: t('Client ID'),
        cell: ({ row }) => (
          <TruncatedCell className='max-w-40 font-mono'>
            {row.original.client_id || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Client ID') },
      },
      {
        accessorKey: 'target_user_id',
        header: t('Target user ID'),
        cell: ({ row }) =>
          row.original.target_user_id
            ? formatNumber(row.original.target_user_id, locale)
            : '—',
        meta: { label: t('Target user ID') },
      },
      {
        accessorKey: 'actor_user_id',
        header: t('Actor user ID'),
        cell: ({ row }) =>
          row.original.actor_user_id
            ? formatNumber(row.original.actor_user_id, locale)
            : '—',
        meta: { label: t('Actor user ID') },
      },
      {
        accessorKey: 'binding_id',
        header: t('Binding ID'),
        cell: ({ row }) => (
          <TruncatedCell className='max-w-40 font-mono'>
            {row.original.binding_id || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Binding ID') },
      },
      {
        accessorKey: 'request_id',
        header: t('Request ID'),
        cell: ({ row }) => (
          <TruncatedCell className='max-w-40 font-mono'>
            {row.original.request_id || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Request ID') },
      },
      { accessorKey: 'ip', header: 'IP', meta: { label: 'IP' } },
      {
        accessorKey: 'route',
        header: t('Route'),
        cell: ({ row }) => (
          <TruncatedCell className='max-w-40 font-mono'>
            {row.original.route || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Route') },
      },
      { accessorKey: 'status', header: 'HTTP', meta: { label: 'HTTP' } },
    ],
    [actionNames, locale, t]
  )
  // An old query result is not proof that the current session still has read access,
  // so rows cached before this mount stay hidden until refetched. Background
  // refetches of rows fetched by this mount keep them visible.
  const showRows = canRead && query.isFetchedAfterMount && !query.isError
  const isLoadingRows =
    query.isPending || (query.isFetching && !query.isFetchedAfterMount)
  const { table } = useDataTable({
    data: showRows ? (query.data?.items ?? EMPTY_LOGS) : EMPTY_LOGS,
    columns,
    getRowId: (log) => log.event_id,
    totalCount: showRows ? (query.data?.total ?? 0) : 0,
    pagination: { pageIndex: filters.page - 1, pageSize: filters.page_size },
    onPaginationChange: (updater) => {
      if (!canRead || query.isError) return
      setFilters((previous) => {
        const current = {
          pageIndex: previous.page - 1,
          pageSize: previous.page_size,
        }
        const next = typeof updater === 'function' ? updater(current) : updater
        return {
          ...previous,
          page: next.pageSize === previous.page_size ? next.pageIndex + 1 : 1,
          page_size: next.pageSize,
        }
      })
    },
    enableRowSelection: false,
    enableSorting: false,
    manualFiltering: true,
    manualPagination: true,
  })

  if (!canRead) {
    return <ErrorState title={t('Access denied')} />
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Authorization logs')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col'>
          <DataTablePage
            table={table}
            columns={columns}
            isLoading={isLoadingRows}
            isFetching={query.isFetching}
            emptyTitle={
              query.isError
                ? t('Failed to load authorization logs')
                : t('No authorization logs found')
            }
            emptyDescription={t(
              'Only new authorization and token events appear here; historical audit records are not included.'
            )}
            className='min-h-0 flex-1'
            toolbar={
              <div className='shrink-0 space-y-2'>
                {query.isPending && (
                  <span role='status' className='sr-only'>
                    {t('Loading...')}
                  </span>
                )}
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                  <Combobox
                    aria-label={t('Event')}
                    options={[
                      { value: 'all', label: t('All events') },
                      ...AUTHORIZATION_LOG_ACTIONS.map((value) => ({
                        value,
                        label: actionNames[value],
                      })),
                    ]}
                    value={draft.action || 'all'}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        action: value === 'all' ? '' : (value ?? ''),
                      }))
                    }
                  />
                  <Combobox
                    aria-label={t('Result')}
                    options={[
                      { value: 'all', label: t('All results') },
                      { value: 'true', label: t('Success') },
                      { value: 'false', label: t('Failed') },
                    ]}
                    value={draft.success || 'all'}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        success: value === 'all' ? '' : (value ?? ''),
                      }))
                    }
                  />
                  <Input
                    aria-label={t('Client ID')}
                    placeholder={t('Client ID')}
                    value={draft.clientId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))
                    }
                    aria-invalid={invalidClient}
                  />
                  <Input
                    aria-label={t('Target user ID')}
                    placeholder={t('Target user ID')}
                    inputMode='numeric'
                    value={draft.targetUserId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        targetUserId: event.target.value,
                      }))
                    }
                    aria-invalid={invalidUser}
                  />
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <CompactDateTimeRangePicker
                    start={
                      draft.start ? new Date(draft.start * 1000) : undefined
                    }
                    end={draft.end ? new Date(draft.end * 1000) : undefined}
                    onChange={({ start, end }) =>
                      setDraft((current) => ({
                        ...current,
                        start: start
                          ? Math.floor(start.getTime() / 1000)
                          : undefined,
                        end: end ? Math.floor(end.getTime() / 1000) : undefined,
                      }))
                    }
                  />
                  <Button
                    disabled={invalidFilters || query.isFetching}
                    onClick={() => {
                      const next = {
                        ...DEFAULT_FILTERS,
                        page_size: filters.page_size,
                        action: draft.action || undefined,
                        success: (draft.success ||
                          undefined) as AuthorizationLogFilters['success'],
                        client_id: draft.clientId.trim() || undefined,
                        target_user_id: draft.targetUserId
                          ? Number(draft.targetUserId.trim())
                          : undefined,
                        start: draft.start,
                        end: draft.end,
                      }
                      setFilters(next)
                      if (JSON.stringify(next) === JSON.stringify(filters)) {
                        void query.refetch()
                      }
                    }}
                  >
                    {t('Search')}
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setDraft({
                        action: '',
                        success: '',
                        clientId: '',
                        targetUserId: '',
                        start: undefined,
                        end: undefined,
                      })
                      setFilters({
                        ...DEFAULT_FILTERS,
                        page_size: filters.page_size,
                      })
                    }}
                  >
                    {t('Reset')}
                  </Button>
                </div>
                {invalidFilters && (
                  <Alert variant='destructive'>
                    <AlertDescription>
                      {t('Check the client ID, target user ID and time range.')}
                    </AlertDescription>
                  </Alert>
                )}
                {query.isError && (
                  <Alert variant='destructive'>
                    <AlertDescription className='flex items-center justify-between gap-2'>
                      <span>{t('Failed to load authorization logs')}</span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => void query.refetch()}
                      >
                        {t('Retry')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            }
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
