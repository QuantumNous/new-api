/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useCommissionRedemptions } from '../hooks/use-commission-redemptions'
import { centsToYuan } from '../lib/format-commission'

const PAGE_SIZE = 20

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleString()
}

export function RedemptionsTable() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useCommissionRedemptions(page, PAGE_SIZE)

  return (
    <div className='space-y-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Time')}</TableHead>
            <TableHead>{t('Commission')}</TableHead>
            <TableHead>{t('Current rate')}</TableHead>
            <TableHead>Quota/Unit</TableHead>
            <TableHead>{t('Credited quota')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-muted-foreground text-center'
              >
                {t('Loading…')}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatTs(r.created_at)}</TableCell>
                <TableCell>¥{centsToYuan(r.commission_cents)}</TableCell>
                <TableCell>{r.usd_exchange_rate.toFixed(4)}</TableCell>
                <TableCell>{r.quota_per_unit.toLocaleString()}</TableCell>
                <TableCell className='font-semibold'>
                  {r.quota_credited.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-muted-foreground text-center'
              >
                {t('No data')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className='flex justify-end gap-2 text-sm'>
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
          disabled={(data?.length ?? 0) < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('Next')}
        </Button>
      </div>
    </div>
  )
}
