import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import {
  AppsSection,
  CategorySections,
  MarketShareSection,
  ModelsSection,
  PulseSection,
  RankingsHero,
} from './components'
import { useRankings } from './hooks/use-rankings'
import type { RankingPeriod } from './types'

const VALID_PERIODS: RankingPeriod[] = ['today', 'week', 'month', 'year', 'all']

export function Rankings() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/rankings/' })
  const navigate = useNavigate()

  const period: RankingPeriod = VALID_PERIODS.includes(
    search.period as RankingPeriod
  )
    ? (search.period as RankingPeriod)
    : 'week'

  const snapshot = useRankings(period)

  const handlePeriodChange = (next: RankingPeriod) => {
    navigate({
      to: '/rankings',
      search: (prev) => ({ ...prev, period: next }),
    })
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1280px] space-y-8 px-3 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12 xl:px-8'>
          <RankingsHero period={period} onPeriodChange={handlePeriodChange} />

          {/* Overall (all-categories) view ----------------------------- */}
          <ModelsSection
            history={snapshot.models_history}
            rows={snapshot.models}
            period={period}
          />

          <MarketShareSection
            history={snapshot.vendor_share_history}
            rows={snapshot.vendors}
            period={period}
          />

          <AppsSection rows={snapshot.apps} />

          <PulseSection
            movers={snapshot.top_movers}
            droppers={snapshot.top_droppers}
            newModels={snapshot.new_models}
          />

          {/* Per-category drill-downs --------------------------------- */}
          <CategorySections sections={snapshot.category_sections} />

          <p className='text-muted-foreground/60 mx-auto max-w-3xl text-center text-[11px] leading-relaxed'>
            {t(
              'Ranking data is currently simulated for preview purposes and will be replaced with live analytics once the backend integration ships.'
            )}
          </p>
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
