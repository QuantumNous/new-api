/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useCommissionRecords } from '../hooks/use-commission-records'
import { centsToYuan } from '../lib/format-commission'
import type { CommissionRecord } from '../types'

const PAGE_SIZE = 20

// statusBadge maps a commission status to a Badge variant so the visual
// language stays consistent across the user + admin views.
function statusBadge(s: CommissionRecord['status']) {
  switch (s) {
    case 'settled':
      return 'default' as const
    case 'pending':
      return 'secondary' as const
    case 'voided':
      return 'outline' as const
  }
}

function formatTs(ts: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export function RecordsTable() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useCommissionRecords({ page, size: PAGE_SIZE })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className='space-y-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Time')}</TableHead>
            <TableHead>{t('Source User')}</TableHead>
            <TableHead>{t('Level')}</TableHead>
            <TableHead>{t('Base Amount')}</TableHead>
            <TableHead>{t('Rate')}</TableHead>
            <TableHead>{t('Commission')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead>{t('Frozen Until')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell
                colSpan={8}
                className='text-muted-foreground text-center'
              >
                {t('Loading…')}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            data?.records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatTs(r.created_at)}</TableCell>
                <TableCell>#{r.source_user_id}</TableCell>
                <TableCell>L{r.level}</TableCell>
                <TableCell>¥{centsToYuan(r.base_amount_cents)}</TableCell>
                <TableCell>{r.rate_percent}%</TableCell>
                <TableCell className='font-semibold'>
                  ¥{centsToYuan(r.commission_amount_cents)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge(r.status)}>{t(r.status)}</Badge>
                </TableCell>
                <TableCell>
                  {r.status === 'pending' ? formatTs(r.frozen_until) : '—'}
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && (data?.records.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className='text-muted-foreground text-center'
              >
                {t('No data')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className='text-muted-foreground flex items-center justify-between text-sm'>
        <span>
          {t('Page')} {page} / {totalPages}
        </span>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
