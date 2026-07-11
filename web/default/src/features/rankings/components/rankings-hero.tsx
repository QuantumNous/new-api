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
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/design-system/tabs'
import { PublicPageHeader } from '@/components/layout'

import type { RankingPeriod } from '../types'

const PERIODS: { id: RankingPeriod; labelKey: string }[] = [
  { id: 'today', labelKey: 'Today' },
  { id: 'week', labelKey: 'Week' },
  { id: 'month', labelKey: 'Month' },
  { id: 'year', labelKey: 'Year' },
]

type RankingsHeroProps = {
  period: RankingPeriod
  onPeriodChange: (period: RankingPeriod) => void
}

export function RankingsHero(props: RankingsHeroProps) {
  const { t } = useTranslation()

  return (
    <PublicPageHeader
      title={t('Rankings')}
      description={t(
        'Discover the most-used models and rising vendors on the platform, updated from live usage data.'
      )}
    >
      <Tabs
        value={props.period}
        onValueChange={(value) => {
          if (
            value === 'today' ||
            value === 'week' ||
            value === 'month' ||
            value === 'year'
          ) {
            props.onPeriodChange(value)
          }
        }}
      >
        <TabsList
          variant='line'
          aria-label={t('Period')}
          className='w-full justify-start gap-6 overflow-x-auto overflow-y-hidden border-b p-0'
        >
          {PERIODS.map((period) => (
            <TabsTrigger
              key={period.id}
              value={period.id}
              className='flex-none px-0.5 pb-3'
            >
              {t(period.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </PublicPageHeader>
  )
}
