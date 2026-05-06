import {
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { formatReleaseDate, formatTokens } from '../lib/format'
import type { NewModelEntry, RankingMover } from '../types'
import { ModelLink, VendorLink } from './entity-links'

type PulseSectionProps = {
  movers: RankingMover[]
  droppers: RankingMover[]
  newModels: NewModelEntry[]
}

/**
 * Three-up "Pulse" panel: rank gainers, rank losers, and recently released
 * models — the "what's changing" footer of the rankings page. Each card
 * is intentionally compact so the trio fits in one row on desktop.
 */
export function PulseSection(props: PulseSectionProps) {
  const { t } = useTranslation()

  return (
    <section className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
      <PulseCard
        title={t('Trending up')}
        description={t('Models climbing the leaderboard')}
        icon={<TrendingUp className='size-4 text-emerald-500' />}
      >
        {props.movers.length === 0 ? (
          <PulseEmpty label={t('No notable climbers right now')} />
        ) : (
          <ul>
            {props.movers.map((row) => (
              <MoverRow key={row.model_name} row={row} intent='up' />
            ))}
          </ul>
        )}
      </PulseCard>

      <PulseCard
        title={t('Trending down')}
        description={t('Models losing positions')}
        icon={<TrendingDown className='size-4 text-rose-500' />}
      >
        {props.droppers.length === 0 ? (
          <PulseEmpty label={t('No notable drops right now')} />
        ) : (
          <ul>
            {props.droppers.map((row) => (
              <MoverRow key={row.model_name} row={row} intent='down' />
            ))}
          </ul>
        )}
      </PulseCard>

      <PulseCard
        title={t('Newly released')}
        description={t('Recently launched models')}
        icon={<Sparkles className='size-4 text-amber-500' />}
      >
        {props.newModels.length === 0 ? (
          <PulseEmpty label={t('No new models yet')} />
        ) : (
          <ul>
            {props.newModels.slice(0, 6).map((row) => (
              <NewModelRow key={row.model_name} row={row} />
            ))}
          </ul>
        )}
      </PulseCard>
    </section>
  )
}

function PulseCard(props: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='bg-card overflow-hidden rounded-lg border'>
      <header className='border-b px-4 py-3'>
        <h3 className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
          {props.icon}
          {props.title}
        </h3>
        <p className='text-muted-foreground/80 mt-0.5 text-xs'>
          {props.description}
        </p>
      </header>
      <div className='py-1'>{props.children}</div>
    </div>
  )
}

function PulseEmpty(props: { label: string }) {
  return (
    <div className='text-muted-foreground/80 px-4 py-6 text-center text-xs'>
      {props.label}
    </div>
  )
}

function MoverRow(props: { row: RankingMover; intent: 'up' | 'down' }) {
  return (
    <li className='flex items-center gap-3 px-4 py-2'>
      <span className='shrink-0'>{getLobeIcon(props.row.vendor_icon, 20)}</span>
      <div className='min-w-0 flex-1'>
        <ModelLink
          modelName={props.row.model_name}
          className='text-foreground block truncate font-mono text-xs font-medium'
        >
          {props.row.model_name}
        </ModelLink>
        <p className='text-muted-foreground/80 truncate text-[11px]'>
          #{props.row.current_rank} ·{' '}
          <VendorLink vendor={props.row.vendor}>
            {props.row.vendor.toLowerCase()}
          </VendorLink>
        </p>
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-semibold tabular-nums',
          props.intent === 'up'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
        )}
      >
        {props.intent === 'up' ? (
          <ArrowUpRight className='size-3' />
        ) : (
          <ArrowDownRight className='size-3' />
        )}
        {Math.abs(props.row.rank_delta)}
      </span>
    </li>
  )
}

function NewModelRow(props: { row: NewModelEntry }) {
  return (
    <li className='flex items-center gap-3 px-4 py-2'>
      <span className='shrink-0'>{getLobeIcon(props.row.vendor_icon, 20)}</span>
      <div className='min-w-0 flex-1'>
        <ModelLink
          modelName={props.row.model_name}
          className='text-foreground block truncate font-mono text-xs font-medium'
        >
          {props.row.model_name}
        </ModelLink>
        <p className='text-muted-foreground/80 truncate text-[11px]'>
          {formatReleaseDate(props.row.release_date)} ·{' '}
          <VendorLink vendor={props.row.vendor}>
            {props.row.vendor.toLowerCase()}
          </VendorLink>
        </p>
      </div>
      <span className='text-foreground shrink-0 font-mono text-xs font-semibold tabular-nums'>
        {formatTokens(props.row.total_tokens)}
      </span>
    </li>
  )
}
