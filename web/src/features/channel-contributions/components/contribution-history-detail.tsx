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
import { CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getChannelContribution } from '../api'
import {
  formatContributionTimestamp,
  getContributionName,
  getSecondaryContributionRevisionStatus,
} from '../lib'
import {
  ContributionRevisionStatusBadge,
  ContributionStatusBadge,
} from './contribution-status'

export function ContributionHistoryDetail(props: {
  id: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const detailQuery = useQuery({
    queryKey: ['channel-contributions', 'mine', 'detail', props.id],
    queryFn: async () => {
      const response = await getChannelContribution(props.id)
      if (!response.success || !response.data) {
        throw new Error(response.message || t('Failed to load contribution'))
      }
      return response.data
    },
    enabled: props.open,
  })
  const contribution = detailQuery.data
  const health = contribution?.model_health ?? []
  const revisionStatus = contribution
    ? getSecondaryContributionRevisionStatus(contribution)
    : null

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='grid max-h-[min(88vh,780px)] grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-4xl'>
        <DialogHeader className='border-b px-4 py-4 pr-12 sm:px-5'>
          <div className='flex min-w-0 items-center gap-2'>
            <DialogTitle className='truncate'>
              {contribution
                ? getContributionName(contribution)
                : t('Contribution details')}
            </DialogTitle>
            {contribution ? (
              <>
                <ContributionStatusBadge status={contribution.status} />
                {revisionStatus ? (
                  <ContributionRevisionStatusBadge status={revisionStatus} />
                ) : null}
              </>
            ) : null}
          </div>
          <DialogDescription>
            {t('Review status and per-model channel health history.')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='min-h-0'>
          <div className='space-y-5 px-4 py-5 sm:px-5'>
            {detailQuery.isLoading ? (
              <p className='text-muted-foreground py-12 text-center text-sm'>
                {t('Loading...')}
              </p>
            ) : null}
            {!detailQuery.isLoading && (detailQuery.error || !contribution) ? (
              <p className='text-destructive py-12 text-center text-sm'>
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : t('Failed to load contribution')}
              </p>
            ) : null}
            {!detailQuery.isLoading && !detailQuery.error && contribution ? (
              <>
                <dl className='grid gap-4 border-y py-4 sm:grid-cols-3'>
                  <div>
                    <dt className='text-muted-foreground text-xs'>
                      {t('Channel ID')}
                    </dt>
                    <dd className='mt-1 text-sm'>
                      {contribution.channel_id ?? '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground text-xs'>
                      {t('Submitted')}
                    </dt>
                    <dd className='mt-1 text-sm'>
                      {formatContributionTimestamp(contribution.submitted_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground text-xs'>
                      {t('Unavailable since')}
                    </dt>
                    <dd className='mt-1 text-sm'>
                      {formatContributionTimestamp(
                        contribution.unavailable_since
                      )}
                    </dd>
                  </div>
                </dl>

                {contribution.review_reason ? (
                  <section className='space-y-1'>
                    <h3 className='text-sm font-semibold'>
                      {t('Review note')}
                    </h3>
                    <p className='text-muted-foreground text-sm break-words'>
                      {contribution.review_reason}
                    </p>
                  </section>
                ) : null}

                <section className='space-y-3'>
                  <div>
                    <h3 className='text-sm font-semibold'>
                      {t('Model health')}
                    </h3>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Health checks continue while the contributed channel is active.'
                      )}
                    </p>
                  </div>
                  {health.length === 0 ? (
                    <div className='text-muted-foreground border-y py-8 text-center text-sm'>
                      {t('No model health observations')}
                    </div>
                  ) : (
                    <div className='overflow-x-auto rounded-lg border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('Model')}</TableHead>
                            <TableHead>{t('Health')}</TableHead>
                            <TableHead>{t('Failure since')}</TableHead>
                            <TableHead>{t('Last checked')}</TableHead>
                            <TableHead>{t('Last success')}</TableHead>
                            <TableHead>{t('Last failure')}</TableHead>
                            <TableHead>{t('Last error')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {health.map((item) => (
                            <TableRow key={`${item.id ?? ''}-${item.model}`}>
                              <TableCell className='max-w-64 font-medium break-all'>
                                {item.model}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    item.healthy
                                      ? 'text-success inline-flex items-center gap-1.5'
                                      : 'text-destructive inline-flex items-center gap-1.5'
                                  }
                                >
                                  {item.healthy ? (
                                    <CheckCircle2
                                      className='size-4'
                                      aria-hidden='true'
                                    />
                                  ) : (
                                    <XCircle
                                      className='size-4'
                                      aria-hidden='true'
                                    />
                                  )}
                                  {item.healthy
                                    ? t('Healthy')
                                    : t('Unavailable')}
                                </span>
                              </TableCell>
                              <TableCell className='whitespace-nowrap'>
                                {formatContributionTimestamp(
                                  item.failure_since
                                )}
                              </TableCell>
                              <TableCell className='whitespace-nowrap'>
                                {formatContributionTimestamp(
                                  item.last_checked_at
                                )}
                              </TableCell>
                              <TableCell className='whitespace-nowrap'>
                                {formatContributionTimestamp(
                                  item.last_success_at
                                )}
                              </TableCell>
                              <TableCell className='whitespace-nowrap'>
                                {formatContributionTimestamp(
                                  item.last_failure_at
                                )}
                              </TableCell>
                              <TableCell className='max-w-72 break-words'>
                                {item.last_error || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
