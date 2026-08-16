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
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getAdminChannelContributions } from '../api'
import {
  formatContributionTimestamp,
  getContributionName,
  getContributionRevision,
  getSecondaryContributionRevisionStatus,
  normalizeContributionList,
  parseContributionModels,
} from '../lib'
import type { ChannelContributionStatus } from '../types'
import {
  ContributionRevisionStatusBadge,
  ContributionStatusBadge,
} from './contribution-status'

const PAGE_SIZE = 20

export function AdminContributionList(props: {
  status?: ChannelContributionStatus
  title: string
  description: string
  onReview: (id: number) => void
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const listQuery = useQuery({
    queryKey: ['channel-contributions', 'admin', props.status ?? 'all', page],
    queryFn: async () => {
      const response = await getAdminChannelContributions({
        page,
        page_size: PAGE_SIZE,
        status: props.status,
      })
      if (!response.success) {
        throw new Error(response.message || t('Failed to load contributions'))
      }
      return normalizeContributionList(response.data)
    },
    placeholderData: (previous) => previous,
  })
  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        {listQuery.isLoading ? (
          <div className='text-muted-foreground flex min-h-48 items-center justify-center text-sm'>
            {t('Loading...')}
          </div>
        ) : null}
        {!listQuery.isLoading && listQuery.error ? (
          <div className='p-4'>
            <Alert variant='destructive'>
              <AlertTitle>{t('Failed to load contributions')}</AlertTitle>
              <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
                <span>
                  {listQuery.error instanceof Error
                    ? listQuery.error.message
                    : t('Failed to load contributions')}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => void listQuery.refetch()}
                >
                  {t('Retry')}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        {!listQuery.isLoading && !listQuery.error && items.length === 0 ? (
          <Empty className='min-h-56'>
            <EmptyHeader>
              <EmptyTitle>{t('No matching contributions')}</EmptyTitle>
              <EmptyDescription>
                {props.status === 'pending'
                  ? t('There are no contributions waiting for review.')
                  : t(
                      'Contributions will appear here when users create drafts.'
                    )}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {!listQuery.isLoading && !listQuery.error && items.length > 0 ? (
          <>
            <div className='hidden overflow-x-auto sm:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Name')}</TableHead>
                    <TableHead>{t('Contributor')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Group')}</TableHead>
                    <TableHead>{t('Models')}</TableHead>
                    <TableHead>{t('Submitted')}</TableHead>
                    <TableHead className='w-20 text-right'>
                      {t('Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((contribution) => {
                    const revision = getContributionRevision(contribution)
                    const revisionStatus =
                      getSecondaryContributionRevisionStatus(contribution)
                    return (
                      <TableRow key={contribution.id}>
                        <TableCell className='max-w-64 font-medium break-words'>
                          {getContributionName(contribution)}
                        </TableCell>
                        <TableCell>
                          <span className='block'>
                            {contribution.username || '-'}
                          </span>
                          <span className='text-muted-foreground text-xs'>
                            {t('ID')} {contribution.user_id ?? '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-1'>
                            <ContributionStatusBadge
                              status={contribution.status}
                            />
                            {revisionStatus ? (
                              <ContributionRevisionStatusBadge
                                status={revisionStatus}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{revision?.group || '-'}</TableCell>
                        <TableCell>
                          {parseContributionModels(revision?.models).length}
                        </TableCell>
                        <TableCell className='text-muted-foreground whitespace-nowrap'>
                          {formatContributionTimestamp(
                            contribution.submitted_at || contribution.updated_at
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            type='button'
                            size='icon-sm'
                            variant='ghost'
                            aria-label={t('Open review')}
                            onClick={() => props.onReview(contribution.id)}
                          >
                            <Search aria-hidden='true' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className='divide-y sm:hidden'>
              {items.map((contribution) => {
                const revision = getContributionRevision(contribution)
                const revisionStatus =
                  getSecondaryContributionRevisionStatus(contribution)
                return (
                  <article key={contribution.id} className='space-y-3 p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <h3 className='font-medium break-words'>
                          {getContributionName(contribution)}
                        </h3>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {contribution.username || '-'} · {t('ID')}{' '}
                          {contribution.user_id ?? '-'}
                        </p>
                      </div>
                      <div className='flex flex-wrap justify-end gap-1'>
                        <ContributionStatusBadge status={contribution.status} />
                        {revisionStatus ? (
                          <ContributionRevisionStatusBadge
                            status={revisionStatus}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                      <span>{revision?.group || '-'}</span>
                      <span>
                        {t('{{count}} models', {
                          count: parseContributionModels(revision?.models)
                            .length,
                        })}
                      </span>
                      <span>
                        {formatContributionTimestamp(
                          contribution.submitted_at || contribution.updated_at
                        )}
                      </span>
                    </div>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      className='w-full'
                      onClick={() => props.onReview(contribution.id)}
                    >
                      <Search data-icon='inline-start' />
                      {t('Open review')}
                    </Button>
                  </article>
                )
              })}
            </div>
          </>
        ) : null}

        {totalPages > 1 ? (
          <div className='flex items-center justify-between border-t px-4 py-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Page {{page}} of {{pages}}', { page, pages: totalPages })}
            </span>
            <div className='flex gap-2'>
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t('Previous')}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
