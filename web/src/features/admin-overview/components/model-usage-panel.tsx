import { PieChart as PieChartIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatPercent, formatTokens } from '@/lib/format'

import type { ModelUsage } from '../types'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
] as const

export function ModelUsagePanel({
  models,
  loading,
}: {
  models: ModelUsage[]
  loading: boolean
}) {
  const { t } = useTranslation()
  const total = models.reduce((sum, model) => sum + model.tokens, 0)
  const data = models
    .slice(0, 5)
    .filter((model) => model.tokens > 0)
    .map((model) => ({
      id: `model:${model.model}`,
      name: model.model,
      tokens: model.tokens,
    }))
  const otherTokens = models
    .slice(5)
    .reduce((sum, model) => sum + model.tokens, 0)
  if (otherTokens > 0) {
    data.push({ id: 'other', name: t('Other'), tokens: otherTokens })
  }

  let content: ReactNode
  if (loading) {
    content = <Skeleton className='h-56 w-full' />
  } else if (total === 0) {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  } else {
    content = (
      <div className='grid items-center gap-5 md:grid-cols-[minmax(180px,240px)_1fr]'>
        <div className='relative mx-auto h-56 w-56'>
          <ChartContainer
            config={{ tokens: { label: t('Tokens') } } satisfies ChartConfig}
            className='aspect-square h-full w-full'
          >
            <PieChart>
              <Pie
                data={data}
                dataKey='tokens'
                nameKey='name'
                innerRadius='68%'
                outerRadius='92%'
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.id} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center'>
            <span className='text-xl font-semibold tabular-nums'>
              {formatTokens(total)}
            </span>
            <span className='text-muted-foreground text-xs'>{t('Tokens')}</span>
          </div>
        </div>
        <ul className='space-y-3'>
          {data.map((entry, index) => (
            <li key={entry.id} className='flex items-center gap-3 text-sm'>
              <span
                className='size-2.5 shrink-0 rounded-full'
                style={{ backgroundColor: COLORS[index] }}
              />
              <span
                className='min-w-0 flex-1 truncate'
                dir='auto'
                title={entry.name}
              >
                {entry.name}
              </span>
              <span className='text-muted-foreground shrink-0 tabular-nums'>
                {formatTokens(entry.tokens)}
              </span>
              <span className='w-14 shrink-0 text-end font-medium tabular-nums'>
                {formatPercent((entry.tokens / total) * 100)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Model Call Analytics')}
      description={t('Top models by token usage in the last 30 days')}
      icon={<PieChartIcon />}
      iconTone='chart-4'
    >
      {content}
    </TitledCard>
  )
}
