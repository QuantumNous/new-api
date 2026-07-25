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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ComputeStats } from '../types'

function formatUsd(value: number): string {
  const amount = Number.isFinite(value) ? value : 0
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function ComputeStatsRow(props: { stats?: ComputeStats }) {
  const { t } = useTranslation()
  const stats = props.stats
  const items = [
    {
      key: 'total',
      title: t('Total nodes'),
      value: stats ? String(stats.total) : '—',
    },
    {
      key: 'running',
      title: t('Running'),
      value: stats ? String(stats.running) : '—',
    },
    {
      key: 'cost',
      title: t('Est. cost per day'),
      value: stats ? formatUsd(stats.est_cost_per_day) : '—',
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              {item.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold tabular-nums'>
              {item.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
