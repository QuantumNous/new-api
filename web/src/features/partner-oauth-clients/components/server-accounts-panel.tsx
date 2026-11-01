/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table/core/badge-cell'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UserQuotaCell } from '@/features/users/components/user-quota-cell'
import { formatTimestamp } from '@/lib/format'

import { listPartnerServerAccounts } from '../api'
import type { PartnerServerAccount } from '../types'

const PAGE_SIZE = 20

function AccountStatus(props: { account: PartnerServerAccount }) {
  const { t } = useTranslation()
  let label = t('Active')
  let variant: 'success' | 'neutral' | 'warning' = 'success'
  if (props.account.status === 'admin_disabled') {
    label = t('Disabled by admin')
    variant = 'neutral'
  } else if (props.account.status === 'disabled') {
    label = t('Disabled by partner')
    variant = 'neutral'
  } else if (props.account.suspended_by_partner) {
    label = t('Suspended')
    variant = 'warning'
  }
  return (
    <BadgeCell>
      <StatusBadge label={label} variant={variant} copyable={false} />
    </BadgeCell>
  )
}

export function PartnerServerAccountsPanel(props: { clientId: number }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const accountsQuery = useQuery({
    queryKey: ['admin', 'partner-server-accounts', props.clientId, page],
    queryFn: () => listPartnerServerAccounts(props.clientId, page, PAGE_SIZE),
  })

  if (accountsQuery.isLoading) {
    return <Skeleton className='h-40 w-full' />
  }
  const total = accountsQuery.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className='space-y-3'>
      <StaticDataTable
        data={accountsQuery.data?.items ?? []}
        getRowKey={(account) => String(account.id)}
        emptyContent={t('No sub-accounts yet.')}
        columns={[
          {
            id: 'external_user_id',
            header: t('Partner user ID'),
            cell: (account) => (
              <span className='font-mono text-xs break-all'>
                {account.external_user_id}
              </span>
            ),
          },
          {
            id: 'user_id',
            header: t('User ID'),
            cell: (account) => account.user_id,
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (account) => <AccountStatus account={account} />,
          },
          {
            id: 'quota',
            header: t('Quota'),
            cell: (account) => (
              <UserQuotaCell
                remaining={account.quota}
                used={account.used_quota}
              />
            ),
          },
          {
            id: 'created',
            header: t('Created'),
            cell: (account) => formatTimestamp(account.created_at),
          },
        ]}
      />
      {pages > 1 && (
        <div className='flex items-center justify-end gap-2'>
          <span className='text-muted-foreground text-sm'>
            {t('Page {{page}} of {{pages}}', { page, pages })}
          </span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('Previous')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      )}
    </div>
  )
}
