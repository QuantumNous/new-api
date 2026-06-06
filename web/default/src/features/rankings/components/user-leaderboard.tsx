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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatTokens, formatShare } from '../lib/format'
import type { UserRanking } from '../types'
import { ModelLink } from './entity-links'

const TOP_VISIBLE = 20

type UserLeaderboardProps = {
  rows: UserRanking[]
}

export function UserLeaderboard(props: UserLeaderboardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const rows = props.rows

  if (rows.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        {t('No user data available')}
      </p>
    )
  }

  const topRows = rows.slice(0, TOP_VISIBLE)
  const foldedRows = rows.slice(TOP_VISIBLE)
  const visibleRows = expanded ? rows : topRows
  const hasFolded = foldedRows.length > 0

  return (
    <div className='overflow-x-auto'>
      <table className='w-full'>
        <thead>
          <tr className='text-muted-foreground border-b text-left text-xs'>
            <th className='pb-2 pr-2 font-medium'>#</th>
            <th className='pb-2 pr-2 font-medium'>{t('User')}</th>
            <th className='pb-2 pr-2 text-right font-medium'>{t('tokens')}</th>
            <th className='pb-2 pr-2 text-right font-medium'>{t('Share')}</th>
            <th className='pb-2 pr-2 text-right font-medium'>{t('Requests')}</th>
            <th className='pb-2 text-right font-medium'>{t('Top Model')}</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr
              key={row.user_id}
              className='border-border/50 hover:bg-muted/30 border-b transition-colors last:border-0'
            >
              <td className='text-muted-foreground/80 py-2.5 pr-2 font-mono text-xs tabular-nums'>
                {row.rank}
              </td>
              <td className='text-foreground py-2.5 pr-2 text-sm font-medium'>
                {row.display_name || row.username}
                {row.display_name && (
                  <span className='text-muted-foreground ml-1 text-xs font-normal'>
                    @{row.username}
                  </span>
                )}
              </td>
              <td className='text-foreground py-2.5 pr-2 text-right font-mono text-sm font-semibold tabular-nums'>
                {formatTokens(row.total_tokens)}
              </td>
              <td className='text-muted-foreground py-2.5 pr-2 text-right font-mono text-xs tabular-nums'>
                {formatShare(row.share)}
              </td>
              <td className='text-muted-foreground py-2.5 pr-2 text-right font-mono text-xs tabular-nums'>
                {row.count.toLocaleString()}
              </td>
              <td className='py-2.5 text-right'>
                <ModelLink
                  modelName={row.top_model}
                  className='text-muted-foreground hover:text-foreground font-mono text-xs transition-colors'
                >
                  {row.top_model}
                </ModelLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasFolded && (
        <button
          onClick={() => setExpanded(!expanded)}
          className='text-muted-foreground hover:text-foreground mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs transition-colors hover:bg-muted/30'
        >
          {expanded ? (
            <>
              <ChevronUp className='size-3.5' />
              {t('Collapse')}
            </>
          ) : (
            <>
              <ChevronDown className='size-3.5' />
              {t('Show all {{count}} users', { count: rows.length })}
            </>
          )}
        </button>
      )}
    </div>
  )
}
