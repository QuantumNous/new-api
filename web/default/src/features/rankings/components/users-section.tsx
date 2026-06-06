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
import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTokens } from '../lib/format'
import type { RankingPeriod, UserRanking } from '../types'
import { UserLeaderboard } from './user-leaderboard'

const USER_PERIOD_DESCRIPTIONS: Record<RankingPeriod, string> = {
  today: 'Top 20 users by token consumption in the last 24 hours',
  week: 'Top 20 users by token consumption this week',
  month: 'Top 20 users by token consumption this month',
  year: 'Top 20 users by token consumption this year',
  all: 'Top 20 users by token consumption since launch',
}

type UsersSectionProps = {
  rows: UserRanking[]
  period: RankingPeriod
}

export function UsersSection(props: UsersSectionProps) {
  const { t } = useTranslation()

  const totalTokens = useMemo(
    () => props.rows.reduce((s, r) => s + r.total_tokens, 0),
    [props.rows]
  )

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      <header className='flex items-start justify-between gap-4 px-5 py-4'>
        <div className='min-w-0 flex-1'>
          <h2 className='text-foreground inline-flex items-center gap-2 text-base font-semibold'>
            <Users className='text-primary size-4' />
            {t('Top Users')}
          </h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t(USER_PERIOD_DESCRIPTIONS[props.period])}
          </p>
        </div>
        <div className='shrink-0 text-right'>
          <div className='text-foreground font-mono text-2xl font-semibold tabular-nums'>
            {formatTokens(totalTokens)}
          </div>
          <div className='text-muted-foreground/80 text-[10px] font-medium tracking-widest uppercase'>
            {t('tokens')}
          </div>
        </div>
      </header>

      <div className='border-t px-5 pt-4 pb-4'>
        <UserLeaderboard rows={props.rows} />
      </div>
    </section>
  )
}
