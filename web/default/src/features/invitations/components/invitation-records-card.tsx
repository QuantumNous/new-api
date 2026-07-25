/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TitledCard } from '@/components/ui/titled-card'
import { formatInvitationUSD } from '../lib/usd'
import type {
  InvitationPageData,
  InvitationReason,
  InvitationStatus,
} from '../types'

interface InvitationRecordsCardProps {
  data: InvitationPageData | null
  loading: boolean
  error: boolean
  page: number
  onRetry: () => void
  onPageChange: (page: number) => void
}

function getStatusPresentation(
  status: InvitationStatus,
  subscriptionMode: boolean
) {
  if (status === 'granted') {
    return { label: 'Reward granted', variant: 'default' as const }
  }
  if (status === 'pending') {
    return subscriptionMode
      ? { label: 'Awaiting subscription', variant: 'secondary' as const }
      : { label: 'Awaiting top-up', variant: 'secondary' as const }
  }
  if (status === 'locked') {
    return { label: 'Locked', variant: 'secondary' as const }
  }
  if (status === 'revoked') {
    return { label: 'Reward revoked', variant: 'destructive' as const }
  }
  return { label: 'Reward unavailable', variant: 'destructive' as const }
}

function getReasonLabel(reason: InvitationReason): string {
  const labels: Record<Exclude<InvitationReason, ''>, string> = {
    inviter_limit_reached: 'You reached the referral reward limit',
    inviter_missing: 'Reward unavailable',
    unavailable: 'Reward unavailable',
    refunded: "Your friend's subscription was refunded",
    disputed: "Your friend's payment was disputed",
  }
  return reason ? labels[reason] : ''
}

export function InvitationRecordsCard({
  data,
  loading,
  error,
  page,
  onRetry,
  onPageChange,
}: InvitationRecordsCardProps) {
  const { t } = useTranslation()
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.page_size))
    : 1
  const navigate =
    (nextPage: number) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      if (nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
        onPageChange(nextPage)
      }
    }

  return (
    <TitledCard title={t('Recent referrals')} contentClassName='p-0 sm:p-0'>
      {error ? (
        <div className='flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center'>
          <div>
            <p className='font-medium'>
              {t("We couldn't load your referrals.")}
            </p>
          </div>
          <div className='flex gap-2'>
            {page > 1 ? (
              <Button variant='outline' onClick={() => onPageChange(page - 1)}>
                {t('Previous')}
              </Button>
            ) : null}
            <Button variant='outline' onClick={onRetry}>
              {t('Retry')}
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className='space-y-3 p-4 sm:p-5'>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className='h-9 w-full' />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className='flex min-h-40 flex-col items-center justify-center p-5 text-center'>
          <p className='font-medium'>{t('No referrals yet')}</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Share your referral link to get started.')}
          </p>
          {page > 1 ? (
            <Button
              variant='outline'
              className='mt-3'
              onClick={() => onPageChange(page - 1)}
            >
              {t('Previous')}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <Table className='min-w-[640px]'>
            <TableHeader>
              <TableRow>
                <TableHead className='pl-4 sm:pl-5'>{t('User')}</TableHead>
                <TableHead>{t('Registered')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className='pr-4 text-right sm:pr-5'>
                  {t('Reward')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((record) => {
                const status = getStatusPresentation(
                  record.status,
                  data.summary?.reward_mode === 'subscription'
                )
                const reason = getReasonLabel(record.reason)
                return (
                  <TableRow key={record.id}>
                    <TableCell className='pl-4 font-medium sm:pl-5'>
                      {record.masked_identity}
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(record.registered_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{t(status.label)}</Badge>
                      {record.status === 'locked' && record.unlock_at > 0 ? (
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {t('Unlocks {{date}}', {
                            date: formatTimestamp(record.unlock_at),
                          })}
                        </p>
                      ) : null}
                      {reason ? (
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {t(reason)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className='pr-4 text-right font-medium tabular-nums sm:pr-5'>
                      {formatInvitationUSD(record.reward_usd)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <Pagination className='border-t p-3'>
              <PaginationContent>
                {page > 1 ? (
                  <PaginationItem>
                    <PaginationPrevious href='#' onClick={navigate(page - 1)} />
                  </PaginationItem>
                ) : null}
                <PaginationItem>
                  <PaginationLink
                    href='#'
                    isActive
                    onClick={(event) => event.preventDefault()}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
                {page < totalPages ? (
                  <PaginationItem>
                    <PaginationNext href='#' onClick={navigate(page + 1)} />
                  </PaginationItem>
                ) : null}
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}
    </TitledCard>
  )
}
