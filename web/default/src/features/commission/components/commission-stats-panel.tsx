import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCommissionStats } from '../api'
import type { CommissionStatsResponse, CommissionPeriod } from '../types'

interface CommissionStatsPanelProps {
  maxLevel?: number
}

export function CommissionStatsPanel({ maxLevel = 3 }: CommissionStatsPanelProps) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<CommissionStatsResponse | null>(null)
  const [period, setPeriod] = useState<CommissionPeriod>('all')
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCommissionStats(period)
      if (res.success && res.data) setStats(res.data)
    } catch { /* handled */ } finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchStats() }, [fetchStats])

  const levelEntries = [
    { key: 'level1' as const, level: 1 },
    { key: 'level2' as const, level: 2 },
    { key: 'level3' as const, level: 3 },
  ].filter((e) => e.level <= maxLevel)

  return (
    <Card className='bg-muted/20 py-0'>
      <CardHeader className='flex flex-row items-center justify-between p-4 sm:p-5'>
        <CardTitle className='text-sm font-semibold'>{t('返佣统计')}</CardTitle>
        <Select value={period} onValueChange={(v) => setPeriod(v as CommissionPeriod)}>
          <SelectTrigger className='h-8 w-28 text-xs'><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('全部')}</SelectItem>
            <SelectItem value='daily'>{t('今日')}</SelectItem>
            <SelectItem value='weekly'>{t('本周')}</SelectItem>
            <SelectItem value='monthly'>{t('本月')}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className='p-4 pt-0 sm:p-5 sm:pt-0'>
        {loading ? (
          <div className='space-y-3'>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className='h-16 rounded-lg' />)}</div>
        ) : (
          <>
            <div className='mb-4 grid grid-cols-3 gap-3'>
              <div className='bg-background rounded-lg border p-3 text-center'>
                <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>{t('总返佣')}</div>
                <div className='mt-0.5 text-lg font-semibold tabular-nums'>{formatQuota(stats?.total_commission ?? 0)}</div>
              </div>
              <div className='bg-background rounded-lg border p-3 text-center'>
                <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>{t('邀请人数')}</div>
                <div className='mt-0.5 text-lg font-semibold tabular-nums'>{stats?.total_invites ?? 0}</div>
              </div>
              <div className='bg-background rounded-lg border p-3 text-center'>
                <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>{t('总消费')}</div>
                <div className='mt-0.5 text-lg font-semibold tabular-nums">{formatQuota(stats?.total_consumption ?? 0)}</div>
              </div>
            </div>
            <div className='space-y-2'>
              {levelEntries.map(({ key, level }) => {
                const lv = stats?.stats?.[key]
                return (
                  <div key={level} className='bg-background flex items-center justify-between rounded-lg border px-3 py-2.5'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='text-xs'>L{level}</Badge>
                      <span className='text-muted-foreground text-xs'>{t('邀请人数')}: {lv?.count ?? 0}</span>
                    </div>
                    <span className='text-xs font-semibold tabular-nums'>{t('返佣')}: {formatQuota(lv?.total_commission ?? 0)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
