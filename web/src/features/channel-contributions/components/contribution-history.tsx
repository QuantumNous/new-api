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
import { Eye, Pencil, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { getChannelContributions, withdrawChannelContribution } from '../api'
import {
  canEditContribution,
  canWithdrawContribution,
  formatContributionTimestamp,
  getContributionName,
  getContributionRevision,
  getSecondaryContributionRevisionStatus,
  normalizeContributionList,
  parseContributionModels,
} from '../lib'
import type { ChannelContribution } from '../types'
import { ContributionHistoryDetail } from './contribution-history-detail'
import {
  ContributionRevisionStatusBadge,
  ContributionStatusBadge,
} from './contribution-status'

const PAGE_SIZE = 20

function HistoryActions(props: {
  contribution: ChannelContribution
  onEdit: (id: number) => void
  onView: (id: number) => void
  onWithdraw: (contribution: ChannelContribution) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='flex justify-end gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              className='size-11 sm:size-8'
              aria-label={t('View contribution details')}
              onClick={() => props.onView(props.contribution.id)}
            />
          }
        >
          <Eye aria-hidden='true' />
        </TooltipTrigger>
        <TooltipContent>{t('View contribution details')}</TooltipContent>
      </Tooltip>
      {canEditContribution(props.contribution) ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                className='size-11 sm:size-8'
                aria-label={t('Edit and resubmit')}
                onClick={() => props.onEdit(props.contribution.id)}
              />
            }
          >
            <Pencil aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Edit and resubmit')}</TooltipContent>
        </Tooltip>
      ) : null}
      {canWithdrawContribution(props.contribution.status) ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                className='size-11 sm:size-8'
                aria-label={t('Withdraw contribution')}
                onClick={() => props.onWithdraw(props.contribution)}
              />
            }
          >
            <Undo2 aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent>{t('Withdraw contribution')}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function ContributionHistory(props: { onEdit: (id: number) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [withdrawTarget, setWithdrawTarget] =
    useState<ChannelContribution | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const historyQuery = useQuery({
    queryKey: ['channel-contributions', 'mine', page],
    queryFn: async () => {
      const response = await getChannelContributions({
        page,
        page_size: PAGE_SIZE,
      })
      if (!response.success) {
        throw new Error(response.message || t('Failed to load contributions'))
      }
      return normalizeContributionList(response.data)
    },
    placeholderData: (previous) => previous,
  })
  const withdrawMutation = useMutation({
    mutationFn: withdrawChannelContribution,
  })

  const handleWithdraw = async () => {
    if (!withdrawTarget) return
    try {
      const response = await withdrawMutation.mutateAsync(withdrawTarget.id)
      if (!response.success) {
        toast.error(response.message || t('Failed to withdraw contribution'))
        return
      }
      setWithdrawTarget(null)
      await queryClient.invalidateQueries({
        queryKey: ['channel-contributions'],
      })
      toast.success(t('Contribution withdrawn'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to withdraw contribution')
      )
    }
  }

  const items = historyQuery.data?.items ?? []
  const total = historyQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('My contributions')}</CardTitle>
        <CardDescription>
          {t(
            'Track review, availability, and deletion status for every channel.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        {historyQuery.isLoading ? (
          <div className='text-muted-foreground flex min-h-48 items-center justify-center text-sm'>
            {t('Loading...')}
          </div>
        ) : null}
        {!historyQuery.isLoading && historyQuery.error ? (
          <div className='p-4'>
            <Alert variant='destructive'>
              <AlertTitle>{t('Failed to load contributions')}</AlertTitle>
              <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
                <span>
                  {historyQuery.error instanceof Error
                    ? historyQuery.error.message
                    : t('Failed to load contributions')}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => void historyQuery.refetch()}
                >
                  {t('Retry')}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        {!historyQuery.isLoading &&
        !historyQuery.error &&
        items.length === 0 ? (
          <Empty className='min-h-56'>
            <EmptyHeader>
              <EmptyTitle>{t('No channel contributions yet')}</EmptyTitle>
              <EmptyDescription>
                {t('Saved drafts and submitted channels will appear here.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {!historyQuery.isLoading && !historyQuery.error && items.length > 0 ? (
          <>
            <div className='hidden overflow-x-auto sm:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Name')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Group')}</TableHead>
                    <TableHead>{t('Models')}</TableHead>
                    <TableHead>{t('Updated')}</TableHead>
                    <TableHead className='w-24 text-right'>
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
                          {contribution.review_reason ? (
                            <p className='text-muted-foreground mt-1 line-clamp-2 text-xs font-normal'>
                              {contribution.review_reason}
                            </p>
                          ) : null}
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
                          {formatContributionTimestamp(contribution.updated_at)}
                        </TableCell>
                        <TableCell>
                          <HistoryActions
                            contribution={contribution}
                            onEdit={props.onEdit}
                            onView={setDetailId}
                            onWithdraw={setWithdrawTarget}
                          />
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
                          {revision?.group || '-'} ·{' '}
                          {t('{{count}} models', {
                            count: parseContributionModels(revision?.models)
                              .length,
                          })}
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
                    {contribution.review_reason ? (
                      <p className='text-muted-foreground text-sm break-words'>
                        {contribution.review_reason}
                      </p>
                    ) : null}
                    <div className='flex items-center justify-between gap-3'>
                      <time className='text-muted-foreground text-xs'>
                        {formatContributionTimestamp(contribution.updated_at)}
                      </time>
                      <HistoryActions
                        contribution={contribution}
                        onEdit={props.onEdit}
                        onView={setDetailId}
                        onWithdraw={setWithdrawTarget}
                      />
                    </div>
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

      <ConfirmDialog
        open={Boolean(withdrawTarget)}
        onOpenChange={(open) => {
          if (!open) setWithdrawTarget(null)
        }}
        title={t('Withdraw channel contribution?')}
        desc={t(
          'The contribution will be deleted and any linked channel will be removed from service.'
        )}
        confirmText={t('Withdraw')}
        destructive
        isLoading={withdrawMutation.isPending}
        handleConfirm={handleWithdraw}
      />
      {detailId ? (
        <ContributionHistoryDetail
          key={detailId}
          id={detailId}
          open
          onOpenChange={(open) => {
            if (!open) setDetailId(null)
          }}
        />
      ) : null}
    </Card>
  )
}
