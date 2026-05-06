import { useMemo } from 'react'
import { VChart } from '@visactor/react-vchart'
import { useTranslation } from 'react-i18next'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'
import { formatTokens } from '../lib/format'
import type { CategorySection as CategorySectionData } from '../types'
import { ModelLeaderboard } from './model-leaderboard'

const TOOLTIP_MAX_ROWS = 8
const MAX_LEADERBOARD_ROWS = 8

type CategorySectionProps = {
  section: CategorySectionData
}

/**
 * Per-category ranking unit: a compact stacked-bar chart of token usage
 * over time paired with a 2-column leaderboard of the top models in that
 * category. Renders as a self-contained card; the rankings page stacks
 * one of these per category for quick browsing.
 */
export function CategorySection(props: CategorySectionProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()

  const orderedPoints = useMemo(() => {
    const order = new Map(
      props.section.models_history.models.map(
        (m, idx) => [m.name, idx] as const
      )
    )
    return [...props.section.models_history.points].sort((a, b) => {
      const tsCmp = a.ts.localeCompare(b.ts)
      if (tsCmp !== 0) return tsCmp
      return (order.get(a.model) ?? 999) - (order.get(b.model) ?? 999)
    })
  }, [props.section.models_history])

  const spec = useMemo(() => {
    if (orderedPoints.length === 0) return null
    return {
      type: 'bar' as const,
      data: [{ id: 'category-history', values: orderedPoints }],
      xField: 'label',
      yField: 'tokens',
      seriesField: 'model',
      stack: true,
      bar: { style: { cornerRadius: 1 } },
      legends: { visible: false },
      axes: [
        {
          orient: 'bottom',
          label: {
            style: { fill: 'currentColor', fontSize: 9 },
            autoHide: true,
            autoLimit: true,
          },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (val: number | string) => formatTokens(Number(val)),
            style: { fill: 'currentColor', fontSize: 9 },
          },
          grid: { visible: true, style: { lineDash: [3, 3] } },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) =>
                String(datum?.model ?? ''),
              value: (datum: Record<string, unknown>) =>
                formatTokens(Number(datum?.tokens) || 0),
            },
          ],
        },
        dimension: {
          title: {
            value: (datum: Record<string, unknown>) =>
              String(datum?.label ?? ''),
          },
          content: [
            {
              key: (datum: Record<string, unknown>) =>
                String(datum?.model ?? ''),
              value: (datum: Record<string, unknown>) =>
                Number(datum?.tokens) || 0,
            },
          ],
          updateContent: (
            array: Array<{ key: string; value: string | number }>
          ) => {
            array.sort((a, b) => Number(b.value) - Number(a.value))
            const visible = array.slice(0, TOOLTIP_MAX_ROWS)
            return visible.map((item) => ({
              key: item.key,
              value: formatTokens(Number(item.value) || 0),
            }))
          },
        },
      },
      animationAppear: { duration: 400 },
    }
  }, [orderedPoints])

  return (
    <article
      id={`category-${props.section.category}`}
      className='bg-card scroll-mt-20 overflow-hidden rounded-lg border'
    >
      <header className='flex items-start justify-between gap-4 px-5 py-3.5'>
        <div className='min-w-0 flex-1'>
          <h3 className='text-foreground text-base font-semibold'>
            {t(props.section.label)}
          </h3>
          <p className='text-muted-foreground/80 mt-0.5 truncate text-xs'>
            {t(props.section.description)}
          </p>
        </div>
        <div className='shrink-0 text-right'>
          <div className='text-foreground font-mono text-base font-semibold tabular-nums'>
            {formatTokens(props.section.total_tokens)}
          </div>
          <div className='text-muted-foreground/80 text-[10px] tracking-widest uppercase'>
            {t('tokens')}
          </div>
        </div>
      </header>

      <div className='px-5 pb-4'>
        <div className='h-44 sm:h-48'>
          {themeReady && spec ? (
            <VChart
              key={`category-history-${props.section.category}-${resolvedTheme}`}
              spec={{
                ...spec,
                theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                background: 'transparent',
              }}
              option={VCHART_OPTION}
            />
          ) : (
            <div className='text-muted-foreground/80 flex h-full items-center justify-center text-xs'>
              {t('No history data available')}
            </div>
          )}
        </div>
      </div>

      {props.section.models.length === 0 ? (
        <div className='text-muted-foreground/80 border-t px-5 py-6 text-center text-sm'>
          {t('No models match the selected filters')}
        </div>
      ) : (
        <div className='border-t px-5 pt-2 pb-4'>
          <ModelLeaderboard
            rows={props.section.models}
            limit={MAX_LEADERBOARD_ROWS}
            variant='compact'
          />
        </div>
      )}
    </article>
  )
}

type CategorySectionsProps = {
  sections: CategorySectionData[]
}

/**
 * Renders the per-category rankings strip (one card per category).
 * Includes a strip header so users understand the page structure shifts
 * from the global view to category drill-downs.
 */
export function CategorySections(props: CategorySectionsProps) {
  const { t } = useTranslation()

  if (props.sections.length === 0) return null

  return (
    <section className='space-y-5'>
      <header className='space-y-1'>
        <p className='text-muted-foreground text-[11px] font-medium tracking-widest uppercase'>
          {t('By category')}
        </p>
        <h2 className='text-foreground text-xl font-semibold tracking-tight'>
          {t('Browse rankings by category')}
        </h2>
        <p className='text-muted-foreground/80 max-w-2xl text-sm'>
          {t('Discover the leading models in each domain')}
        </p>
      </header>
      <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
        {props.sections.map((section) => (
          <CategorySection key={section.category} section={section} />
        ))}
      </div>
    </section>
  )
}
