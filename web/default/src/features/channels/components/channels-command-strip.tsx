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
import { Activity, Gauge, Route, TestTube } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'

export function ChannelsCommandStrip() {
  const { t } = useTranslation()

  return (
    <section className='grid gap-3 md:grid-cols-3'>
      <OperationalMetricCard
        label={t('Route health')}
        value={t('Live')}
        description={t('Use status filters to isolate failed or disabled providers.')}
        icon={<Activity className='size-4' aria-hidden='true' />}
        tone='success'
      />
      <OperationalMetricCard
        label={t('Provider coverage')}
        value={t('Multi-upstream')}
        description={t('Group, type, and model filters keep routing decisions visible.')}
        icon={<Route className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Operational actions')}
        value={t('Ready')}
        description={t('Test channels and refresh balances from the action menu.')}
        icon={<TestTube className='size-4' aria-hidden='true' />}
        tone='warning'
        action={<Gauge className='text-muted-foreground size-4' aria-hidden='true' />}
      />
    </section>
  )
}
