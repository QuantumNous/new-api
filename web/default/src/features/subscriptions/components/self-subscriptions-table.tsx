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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { Info } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelfSubscriptionFull } from '../api'
import { formatTimestamp } from '../lib'

export function SelfSubscriptionsTable() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['self-subscriptions'],
    queryFn: async () => {
      const result = await getSelfSubscriptionFull()
      if (!result.success) {
        toast.error(result.message || t('Failed to load subscriptions'))
        return null
      }
      return result.data || null
    },
  })

  const subs = useMemo(() => data?.subscriptions || [], [data])

  if (isLoading) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-8 w-full' />
      </div>
    )
  }

  if (subs.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12 text-center'>
        <Info className='mb-2 size-8 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>
          {t('No subscription records')}
        </p>
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border border-border'>
      <Table>
        <TableHeader className='bg-muted/30'>
          <TableRow>
            <TableHead>{t('Plan')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead>{t('Start Date')}</TableHead>
            <TableHead>{t('End Date')}</TableHead>
            <TableHead className='text-right'>{t('Quota')}</TableHead>
            <TableHead className='w-20 text-right'>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subs.map((record) => {
            const sub = record.subscription
            const now = Date.now() / 1000
            const isExpired = (sub.end_time || 0) > 0 && sub.end_time < now
            const isActive = sub.status === 'active' && !isExpired
            const total = Number(sub.amount_total || 0)
            const used = Number(sub.amount_used || 0)

            return (
              <TableRow key={sub.id}>
                <TableCell className='text-sm'>
                  <div className='font-medium'>#{sub.plan_id}</div>
                </TableCell>
                <TableCell>
                  {isActive ? (
                    <Badge
                      variant='default'
                      className='rounded-full text-[11px] bg-primary/10 text-primary'
                    >
                      {t('Active')}
                    </Badge>
                  ) : sub.status === 'cancelled' ? (
                    <Badge
                      variant='secondary'
                      className='rounded-full text-[11px]'
                    >
                      {t('Cancelled')}
                    </Badge>
                  ) : (
                    <Badge
                      variant='secondary'
                      className='rounded-full text-[11px]'
                    >
                      {t('Expired')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className='font-mono text-sm'>
                  {formatTimestamp(sub.start_time)}
                </TableCell>
                <TableCell className='font-mono text-sm'>
                  {sub.end_time > 0 ? formatTimestamp(sub.end_time) : '-'}
                </TableCell>
                <TableCell className='text-right font-mono text-sm'>
                  {total > 0 ? `${used}/${total}` : t('Unlimited')}
                </TableCell>
                <TableCell className='text-right'>
                  <Button variant='ghost' size='sm' className='h-7 text-xs'>
                    {t('Details')}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
