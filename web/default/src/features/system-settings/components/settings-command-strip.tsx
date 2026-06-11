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
import { CreditCard, LockKeyhole, ServerCog, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'

export function SettingsCommandStrip() {
  const { t } = useTranslation()

  return (
    <section className='grid gap-3 md:grid-cols-4'>
      <OperationalMetricCard
        label={t('Identity')}
        value={t('Brand')}
        description={t('System name, logo, docs, and public content define the gateway surface.')}
        icon={<SlidersHorizontal className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Access')}
        value={t('Guarded')}
        description={t('Login, OAuth, passkeys, and bot protection shape who can operate.')}
        icon={<LockKeyhole className='size-4' aria-hidden='true' />}
        tone='success'
      />
      <OperationalMetricCard
        label={t('Billing')}
        value={t('Accounted')}
        description={t('Quota, currency, pricing, and payment settings stay audit-friendly.')}
        icon={<CreditCard className='size-4' aria-hidden='true' />}
        tone='warning'
      />
      <OperationalMetricCard
        label={t('Operations')}
        value={t('Controlled')}
        description={t('Logs, performance, exports, limits, and maintenance live in one control plane.')}
        icon={<ServerCog className='size-4' aria-hidden='true' />}
        tone='neutral'
      />
    </section>
  )
}
