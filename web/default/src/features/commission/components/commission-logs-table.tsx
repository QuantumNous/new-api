import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getCommissionLogs } from '../api'
import type { CommissionLog } from '../types'

const PAGE_SIZE = 20

export function CommissionLogsTable() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<CommissionLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE }
      if (statusFilter !== 'all') params.status = statusFilter
      const res = await getCommissionLogs(params as never)
      if (res.success && res.data) {
        setLogs(res.data.items)
        setTotal(res.data.total)
      }
    } catch { /* handled */ } finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: t('待结算'), cls: 'bg-amber-500/10 text-amber-500' },
      settled: { label: t('已结算'), cls: 'bg-emerald-500/10 text-emerald-500' },
      refunded: { label: t('已退还'), cls: 'bg-red-500/10 text-red-500' },
    }
    const cfg = map[status] || { label: status, cls: '' }
    return <Badge variant='secondary' className={cfg.cls}>{cfg.label}</Badge>
  }

  const formatDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleString() : '-'

  return (
    <Card className='bg-muted/20 py-0'>
      <CardHeader className='flex flex-row items-center justify-between p-4 sm:p-5'>
        <CardTitle className='text-sm font-semibold'>{t('返佣明细')}</CardTitle>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className='h-8 w-28 text-xs'><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('全部')}</SelectItem>
            <SelectItem value='pending'>{t('待结算')}</SelectItem>
            <SelectItem value='settled'>{t('已结算')}</SelectItem>
            <SelectItem value='refunded'>{t('已退还')}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('消费者')}</TableHead>
                <TableHead>{t('层级')}</TableHead>
                <TableHead>{t('模型')}</TableHead>
                <TableHead className='text-right'>{t('消费额')}</TableHead>
                <TableHead className='text-right'>{t('比例')}</TableHead>
                <TableHead className='text-right'>{t('返佣')}</TableHead>
                <TableHead>{t('状态')}</TableHead>
                <TableHead>{t('时间')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className='h-4 w-16' /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground py-8 text-center text-sm'>
                    {t('暂无返佣记录')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className='font-mono text-xs'>{log.username}</TableCell>
                    <TableCell><Badge variant='outline' className='text-xs'>L{log.level}</Badge></TableCell>
                    <TableCell className='text-xs'>{log.model_name}</TableCell>
                    <TableCell className='text-right font-mono text-xs tabular-nums'>{formatQuota(log.consumption)}</TableCell>
                    <TableCell className='text-right text-xs tabular-nums'>{(log.rate * 100).toFixed(1)}%</TableCell>
                    <TableCell className='text-right font-mono text-xs font-medium tabular-nums">{formatQuota(log.commission)}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className='text-muted-foreground text-xs'>{formatDate(log.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className='flex items-center justify-between border-t px-4 py-3'>
            <span className='text-muted-foreground text-xs'>{t('共 {{count}} 条', { count: total })}</span>
            <div className='flex items-center gap-1'>
              <Button variant='outline' size='sm' className='h-7 px-2 text-xs' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('上一页')}</Button>
              <span className='px-2 text-xs tabular-nums'>{page}/{totalPages}</span>
              <Button variant='outline' size='sm' className='h-7 px-2 text-xs' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('下一页')}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
