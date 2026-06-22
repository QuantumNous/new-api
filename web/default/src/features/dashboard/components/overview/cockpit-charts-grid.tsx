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
import { CardStaggerContainer, CardStaggerItem } from '@/components/page-transition'
import { CockpitCallTrend } from './cockpit-call-trend'
import { CockpitTenantRanking } from './cockpit-tenant-ranking'
import { PerformanceHealthPanel } from './performance-health-panel'
import { UptimePanel } from './uptime-panel'

interface CockpitChartsGridProps {
  isAdmin: boolean
}

export function CockpitChartsGrid(props: CockpitChartsGridProps) {
  const { t } = useTranslation()

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1 px-0.5'>
        <h3 className='text-sm font-semibold text-slate-900'>
          {t('Dashboard charts section title')}
        </h3>
        <p className='text-xs text-slate-600'>
          {t('Dashboard charts section description')}
        </p>
      </div>

      <CardStaggerContainer className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <CardStaggerItem>
          <CockpitCallTrend />
        </CardStaggerItem>

        {props.isAdmin ? (
          <CardStaggerItem>
            <PerformanceHealthPanel variant='cockpit-ranking' />
          </CardStaggerItem>
        ) : null}

        <CardStaggerItem>
          <UptimePanel variant='cockpit' />
        </CardStaggerItem>

        {props.isAdmin ? (
          <CardStaggerItem>
            <CockpitTenantRanking />
          </CardStaggerItem>
        ) : null}
      </CardStaggerContainer>
    </section>
  )
}
