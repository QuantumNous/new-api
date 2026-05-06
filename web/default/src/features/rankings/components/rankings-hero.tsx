import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { RankingPeriod } from '../types'

const PERIODS: { id: RankingPeriod; labelKey: string }[] = [
  { id: 'today', labelKey: 'Today' },
  { id: 'week', labelKey: 'Week' },
  { id: 'month', labelKey: 'Month' },
  { id: 'year', labelKey: 'Year' },
  { id: 'all', labelKey: 'All-time' },
]

type RankingsHeroProps = {
  period: RankingPeriod
  onPeriodChange: (period: RankingPeriod) => void
}

/**
 * Hero strip for the rankings page. Intentionally minimal — title +
 * subtitle + period tabs only. Category filtering is no longer needed
 * because every category is rendered inline as its own section further
 * down the page.
 */
export function RankingsHero(props: RankingsHeroProps) {
  const { t } = useTranslation()

  return (
    <section className='space-y-5'>
      <div className='space-y-2'>
        <p className='text-muted-foreground text-xs font-medium tracking-widest uppercase'>
          {t('Leaderboards')}
        </p>
        <h1 className='text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] font-bold tracking-tight'>
          {t('Rankings')}
        </h1>
        <p className='text-muted-foreground/80 max-w-2xl text-sm'>
          {t(
            'Discover the most-used models, top apps, and rising vendors on the platform — updated continuously across every category.'
          )}
        </p>
      </div>

      {/* Underline tabs for period — clean and unobtrusive. */}
      <div
        role='tablist'
        aria-label={t('Period')}
        className='border-border/60 flex items-center border-b'
      >
        {PERIODS.map((p) => {
          const isActive = props.period === p.id
          return (
            <button
              key={p.id}
              role='tab'
              type='button'
              aria-selected={isActive}
              onClick={() => props.onPeriodChange(p.id)}
              className={cn(
                'focus-visible:ring-ring/40 relative -mb-px rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(p.labelKey)}
              <span
                aria-hidden
                className={cn(
                  'bg-foreground absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
