import { useMemo } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Trophy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildAppRankings,
  formatTokenVolume,
  type AppRanking,
} from '../lib/mock-stats'
import type { PricingModel } from '../types'

const COMPACT_NUMBER = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function RankBadge(props: { rank: number }) {
  const rank = props.rank
  const isPodium = rank <= 3
  const palette =
    rank === 1
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
      : rank === 2
        ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
        : rank === 3
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold tabular-nums',
        palette
      )}
    >
      {isPodium ? <Trophy className='size-3.5' /> : rank}
    </span>
  )
}

function GrowthChip(props: { value: number }) {
  const value = props.value
  const isUp = value > 0
  const isDown = value < 0
  const palette = isUp
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
    : isDown
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
      : 'bg-muted text-muted-foreground'
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : null
  const formatted = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
        palette
      )}
    >
      {Icon && <Icon className='size-3' />}
      {formatted}
    </span>
  )
}

function AppLink(props: { app: AppRanking }) {
  if (!props.app.url) {
    return <span className='text-foreground'>{props.app.name}</span>
  }
  return (
    <a
      href={props.app.url}
      target='_blank'
      rel='noreferrer'
      className='text-foreground hover:text-primary inline-flex items-center gap-1 transition-colors'
    >
      {props.app.name}
      <ExternalLink className='text-muted-foreground/40 size-3' />
    </a>
  )
}

export function ModelDetailsApps(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const apps = useMemo(() => buildAppRankings(props.model, 12), [props.model])

  if (apps.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>
        {t('No app usage data available for this model.')}
      </div>
    )
  }

  const totalMonthlyTokens = apps.reduce((s, a) => s + a.monthly_tokens, 0)
  const top = apps[0]
  const headerCellClass =
    'text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase'

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        <div className='bg-muted/20 rounded-lg border p-3'>
          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
            {t('Tracked apps')}
          </div>
          <div className='text-foreground mt-1 font-mono text-lg font-semibold tabular-nums'>
            {apps.length}
          </div>
          <p className='text-muted-foreground/70 text-[11px]'>
            {t('Top integrations using this model')}
          </p>
        </div>
        <div className='bg-muted/20 rounded-lg border p-3'>
          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
            {t('Monthly tokens')}
          </div>
          <div className='text-foreground mt-1 font-mono text-lg font-semibold tabular-nums'>
            {COMPACT_NUMBER.format(totalMonthlyTokens)}
          </div>
          <p className='text-muted-foreground/70 text-[11px]'>
            {t('Aggregated across the apps below')}
          </p>
        </div>
        <div className='bg-muted/20 rounded-lg border p-3'>
          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
            {t('#1 by usage')}
          </div>
          <div className='text-foreground mt-1 truncate text-base font-semibold'>
            {top.name}
          </div>
          <p className='text-muted-foreground/70 truncate text-[11px]'>
            {top.category} · {formatTokenVolume(top.monthly_tokens)}{' '}
            {t('tokens / mo')}
          </p>
        </div>
      </div>

      <div className='overflow-x-auto rounded-lg border'>
        <Table className='text-sm'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className={cn(headerCellClass, 'w-12')}>#</TableHead>
              <TableHead className={headerCellClass}>{t('App')}</TableHead>
              <TableHead
                className={cn(headerCellClass, 'hidden md:table-cell')}
              >
                {t('Category')}
              </TableHead>
              <TableHead className={`${headerCellClass} text-right`}>
                {t('Monthly tokens')}
              </TableHead>
              <TableHead className={`${headerCellClass} text-right`}>
                {t('30d change')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={`${app.rank}-${app.name}`}>
                <TableCell className='py-2.5'>
                  <RankBadge rank={app.rank} />
                </TableCell>
                <TableCell className='py-2.5'>
                  <div className='flex items-center gap-3'>
                    <span className='bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md font-bold'>
                      {app.initial}
                    </span>
                    <div className='min-w-0'>
                      <div className='text-sm font-medium'>
                        <AppLink app={app} />
                      </div>
                      <p className='text-muted-foreground line-clamp-1 text-xs'>
                        {app.description}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground hidden py-2.5 text-xs md:table-cell'>
                  {app.category}
                </TableCell>
                <TableCell className='py-2.5 text-right font-mono tabular-nums'>
                  {formatTokenVolume(app.monthly_tokens)}
                </TableCell>
                <TableCell className='py-2.5 text-right'>
                  <GrowthChip value={app.growth_pct} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className='text-muted-foreground/60 text-[11px] leading-relaxed'>
        {t(
          'App rankings shown here are simulated for preview purposes and will be replaced with live usage data once the backend integration is complete.'
        )}
      </p>
    </div>
  )
}
