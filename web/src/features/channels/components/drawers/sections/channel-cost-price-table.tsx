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
import type { ChannelModelCost } from '@/features/channels/types'

type ChannelCostPriceTableProps = {
  prices?: Record<string, ChannelModelCost>
}

function formatRatio(value: number | undefined): string {
  if (value == null || value === 0) return '-'
  return Number(value.toFixed(4)).toString()
}

/**
 * Read-only table showing the per-model cost price table synced from the
 * channel's own upstream (used by the channel cost settings section).
 */
export function ChannelCostPriceTable(props: ChannelCostPriceTableProps) {
  const { t } = useTranslation()
  const prices = props.prices ?? {}
  const entries = Object.entries(prices)

  if (entries.length === 0) {
    return (
      <div className='text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs'>
        {t('No model cost prices synced yet.')}
      </div>
    )
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='bg-muted/50 text-muted-foreground border-b text-left text-xs'>
            <th className='px-3 py-2 font-medium'>{t('Model')}</th>
            <th className='px-3 py-2 font-medium'>{t('Type')}</th>
            <th className='px-3 py-2 font-medium'>{t('Price')}</th>
            <th className='px-3 py-2 font-medium'>
              {t('Completion Ratio')}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([model, mc]) => {
            const isPrice = Number(mc.model_price) > 0
            return (
              <tr key={model} className='border-b last:border-0'>
                <td className='px-3 py-2 font-mono text-xs'>{model}</td>
                <td className='px-3 py-2'>
                  {isPrice ? (
                    <Badge variant='secondary'>{t('Per Call')}</Badge>
                  ) : (
                    <Badge variant='outline'>{t('Per Token')}</Badge>
                  )}
                </td>
                <td className='px-3 py-2 font-mono text-xs'>
                  {isPrice
                    ? `$${formatRatio(mc.model_price)}`
                    : formatRatio(mc.model_ratio)}
                </td>
                <td className='px-3 py-2 font-mono text-xs'>
                  {formatRatio(mc.completion_ratio)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
