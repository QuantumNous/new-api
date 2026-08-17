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

import { Badge } from '@/components/ui/badge'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { ChannelProfitRow } from '@/features/dashboard/types'

export function ChannelProfitTable(props: {
  rows?: ChannelProfitRow[]
  loading?: boolean
}) {
  const { t } = useTranslation()
  const rows = props.rows ?? []
  const loading = props.loading

  return (
    <PanelWrapper
      title={t('By Channel')}
      loading={loading}
      empty={!loading && rows.length === 0}
      contentClassName='p-0'
    >
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-muted-foreground border-border/60 border-b text-left'>
              <th className='px-3 py-2 font-medium sm:px-5'>{t('Channel')}</th>
              <th className='px-3 py-2 font-medium'>{t('Calls')}</th>
              <th className='px-3 py-2 font-medium'>{t('Revenue')}</th>
              <th className='px-3 py-2 font-medium'>{t('Cost')}</th>
              <th className='px-3 py-2 font-medium'>{t('Profit')}</th>
              <th className='px-3 py-2 font-medium'>{t('Profit Rate')}</th>
              <th className='px-3 py-2 font-medium'>{t('Cost Config')}</th>
            </tr>
          </thead>
          <tbody className='divide-border/60 divide-y'>
            {rows.map((row) => (
              <tr key={row.channel_id}>
                <td className='px-3 py-2 font-medium sm:px-5'>
                  {row.channel_name || `#${row.channel_id}`}
                </td>
                <td className='px-3 py-2 tabular-nums'>{row.count}</td>
                <td className='px-3 py-2 tabular-nums'>
                  {formatQuota(row.revenue)}
                </td>
                <td className='px-3 py-2 tabular-nums'>
                  {formatQuota(row.cost)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 tabular-nums',
                    row.profit > 0 && 'text-success',
                    row.profit < 0 && 'text-destructive'
                  )}
                >
                  {row.profit >= 0 ? '+' : ''}
                  {formatQuota(row.profit)}
                </td>
                <td className='px-3 py-2 tabular-nums'>
                  {(row.profit_rate * 100).toFixed(1)}%
                </td>
                <td className='px-3 py-2'>
                  {row.cost_enabled ? (
                    <Badge variant='outline'>{t('Enabled')}</Badge>
                  ) : (
                    <Badge variant='secondary'>{t('Not configured')}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelWrapper>
  )
}
