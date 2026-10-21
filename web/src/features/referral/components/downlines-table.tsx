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

import { useCommissionDownlines } from '../hooks/use-commission-downlines'

const PAGE_SIZE = 20

function formatTs(ts: number) {
  return new Date(ts * 1000).toLocaleString()
}

export function DownlinesTable() {
  const { t } = useTranslation()
  const [level, setLevel] = useState<1 | 2>(1)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useCommissionDownlines(level, page, PAGE_SIZE)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className='space-y-3'>
      <div className='flex gap-2'>
        <Button
          variant={level === 1 ? 'default' : 'outline'}
          size='sm'
          onClick={() => {
            setLevel(1)
            setPage(1)
          }}
        >
          L1
        </Button>
        <Button
          variant={level === 2 ? 'default' : 'outline'}
          size='sm'
          onClick={() => {
            setLevel(2)
            setPage(1)
          }}
        >
          L2
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Registered At')}</TableHead>
            <TableHead>User ID</TableHead>
            <TableHead>{t('Username')}</TableHead>
            <TableHead>{t('Email')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-muted-foreground text-center'
              >
                {t('Loading…')}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            data?.rows.map((r) => (
              <TableRow key={r.user_id}>
                <TableCell>{formatTs(r.created_at)}</TableCell>
                <TableCell>#{r.user_id}</TableCell>
                <TableCell>{r.username || '—'}</TableCell>
                <TableCell>{r.email || '—'}</TableCell>
              </TableRow>
            ))}
          {!isLoading && (data?.rows.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
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
