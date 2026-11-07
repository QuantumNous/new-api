/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatInteger, formatLogQuota, formatPercent, formatTokens } from '@/lib/format'

import type { ModelUsage } from '../types'

const RANK_COLORS = [
  'bg-amber-500 text-white',
  'bg-slate-400 text-slate-900',
  'bg-amber-700 text-white',
] as const

export interface TopModelsPanelProps {
  models: ModelUsage[]
  loading: boolean
}

export function TopModelsPanel(props: TopModelsPanelProps) {
  const { t } = useTranslation()
  const maxTokens = props.models.reduce(
    (max, model) => Math.max(max, model.tokens),
    0
  )
  const totalQuota = props.models.reduce((sum, model) => sum + model.quota, 0)
  const hasData = maxTokens > 0

  let content: ReactNode
  if (props.loading) {
    content = (
      <div className='space-y-4'>
        {['model-1', 'model-2', 'model-3', 'model-4'].map((key) => (
          <Skeleton key={key} className='h-10 w-full' />
        ))}
      </div>
    )
  } else if (hasData) {
    content = (
      <ol className='space-y-4'>
        {props.models.map((model, index) => {
          const share = maxTokens > 0 ? (model.tokens / maxTokens) * 100 : 0
          const totalShare = totalQuota > 0 ? (model.quota / totalQuota) * 100 : 0
          const rankColor = RANK_COLORS[index] ?? 'bg-muted text-muted-foreground'

          return (
            <li key={model.model}>
              <div className='flex items-center justify-between gap-3'>
                <span className='flex min-w-0 items-center gap-2'>
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold tabular-nums ${rankColor}`}>
                    {index + 1}
                  </span>
                  <span
                    className='truncate font-mono text-xs sm:text-sm'
                    dir='auto'
                    title={model.model}
                  >
                    {model.model}
                  </span>
                </span>
                <span className='shrink-0 font-mono text-xs font-semibold tabular-nums'>
                  {formatTokens(model.tokens)}
                </span>
              </div>
              <Progress
                value={share}
                aria-label={`${model.model}: ${formatTokens(model.tokens)} ${t('Tokens')}`}
                className='mt-1.5 gap-0'
              />
              <div className='text-muted-foreground mt-1 flex items-center justify-between gap-2 text-[11px]'>
                <span>
                  {t('Requests')}: {formatInteger(model.requests)}
                </span>
                <span>
                  {t('Revenue')}: {formatLogQuota(model.quota)}
                </span>
                <span className='shrink-0 font-medium text-foreground tabular-nums'>
                  {t('Share of usage')}: {formatPercent(totalShare)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    )
  } else {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Top used models')}
      description={t('Top models by token usage in the last 30 days')}
      icon={<Trophy />}
      iconTone='warning'
    >
      {content}
    </TitledCard>
  )
}
