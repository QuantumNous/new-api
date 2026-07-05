import { Share2, TrendingUp, Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { CopyButton } from '@/components/copy-button'
import type { CommissionInfo } from '../types'

interface CommissionOverviewCardProps {
  info: CommissionInfo | null
  affiliateLink: string
  loading?: boolean
}

export function CommissionOverviewCard({
  info,
  affiliateLink,
  loading,
}: CommissionOverviewCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='p-4 sm:p-5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='mt-2 h-4 w-64' />
          <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-16 rounded-lg' />
            ))}
          </div>
          <Skeleton className='mt-4 h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const stats = [
    {
      icon: <TrendingUp className='size-4 text-emerald-400' />,
      label: t('累计返佣'),
      value: formatQuota(info?.total_commission ?? 0),
    },
    {
      icon: <Clock className='size-4 text-amber-400' />,
      label: t('待结算'),
      value: formatQuota(info?.pending_commission ?? 0),
    },
    {
      icon: <TrendingUp className='size-4 text-blue-400' />,
      label: t('已结算'),
      value: formatQuota(info?.settled_commission ?? 0),
    },
    {
      icon: <Users className='size-4 text-violet-400' />,
      label: t('邀请人数'),
      value: String(info?.aff_count ?? 0),
    },
  ]

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='p-4 sm:p-5'>
        <div className='flex items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <Share2 className='text-muted-foreground size-4' />
          </div>
          <div>
            <h3 className='text-sm font-semibold'>{t('返佣概览')}</h3>
            <p className='text-muted-foreground text-xs'>
              {t('邀请好友注册消费,即可获得返佣奖励')}
            </p>
          </div>
        </div>

        <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {stats.map((s) => (
            <div
              key={s.label}
              className='bg-background rounded-lg border p-3 text-center'
            >
              <div className='flex items-center justify-center gap-1.5'>
                {s.icon}
                <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                  {s.label}
                </span>
              </div>
              <div className='mt-1 text-lg font-semibold tabular-nums'>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className='mt-4 flex items-center gap-2'>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('复制邀请链接')}
            aria-label={t('复制邀请链接')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
