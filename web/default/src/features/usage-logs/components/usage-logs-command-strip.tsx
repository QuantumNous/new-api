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
import { AlertTriangle, Clock3, ListTree, ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'
import type { LogCategory } from '../types'

interface UsageLogsCommandStripProps {
  logCategory: LogCategory
}

export function UsageLogsCommandStrip(props: UsageLogsCommandStripProps) {
  const { t } = useTranslation()
  const isCommon = props.logCategory === 'common'

  return (
    <section className='grid gap-3 md:grid-cols-4'>
      <OperationalMetricCard
        label={t('Trace surface')}
        value={isCommon ? t('API calls') : t('Async jobs')}
        description={t('Inspect request flow without losing table context.')}
        icon={<ListTree className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Time window')}
        value={t('Filter-first')}
        description={t('Start with time range, then narrow by model, token, or user.')}
        icon={<Clock3 className='size-4' aria-hidden='true' />}
        tone='neutral'
      />
      <OperationalMetricCard
        label={t('Failure review')}
        value={t('Inline')}
        description={t('Error and refund rows keep their operator tint while scanning.')}
        icon={<AlertTriangle className='size-4' aria-hidden='true' />}
        tone='warning'
      />
      <OperationalMetricCard
        label={t('Billing context')}
        value={t('Aligned')}
        description={t('Quota, tokens, and costs stay readable with tabular values.')}
        icon={<ReceiptText className='size-4' aria-hidden='true' />}
        tone='success'
      />
    </section>
  )
}
