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
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiKeyStats } from '../types'

type ApiKeyStatisticsProps = {
  stats: ApiKeyStats
  isLoading: boolean
}

export function ApiKeyStatistics(props: ApiKeyStatisticsProps) {
  const { t } = useTranslation()
  const items = [
    { label: t('Total'), value: props.stats.total },
    { label: t('Enabled'), value: props.stats.enabled },
    { label: t('Disabled'), value: props.stats.disabled },
    { label: t('Expired'), value: props.stats.expired },
    { label: t('Exhausted'), value: props.stats.exhausted },
  ]

  return (
    <Card size='sm' aria-live='polite'>
      <CardHeader>
        <CardTitle>{t('API Key Statistics')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
          {items.map((item) => (
            <div key={item.label} className='bg-muted/50 rounded-lg px-3 py-2'>
              <div className='text-muted-foreground text-xs font-medium'>
                {item.label}
              </div>
              {props.isLoading ? (
                <Skeleton className='mt-2 h-7 w-12' />
              ) : (
                <div className='mt-1 font-mono text-2xl font-semibold tabular-nums'>
                  {item.value.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
