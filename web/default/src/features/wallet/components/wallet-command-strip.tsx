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
import { BadgeDollarSign, History, ReceiptText, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'

export function WalletCommandStrip() {
  const { t } = useTranslation()

  return (
    <section className='grid gap-3 md:grid-cols-4'>
      <OperationalMetricCard
        label={t('Balance runway')}
        value={t('Tracked')}
        description={t('Current quota, recent burn, and subscriptions stay visible before top-up.')}
        icon={<WalletCards className='size-4' aria-hidden='true' />}
        tone='success'
      />
      <OperationalMetricCard
        label={t('Top-up flow')}
        value={t('Guided')}
        description={t('Preset amounts, exchange rate, discount, and payment method stay in one flow.')}
        icon={<BadgeDollarSign className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Billing history')}
        value={t('Auditable')}
        description={t('Invoices, purchases, and quota movement remain one click away.')}
        icon={<History className='size-4' aria-hidden='true' />}
        tone='neutral'
      />
      <OperationalMetricCard
        label={t('Rewards')}
        value={t('Transferable')}
        description={t('Affiliate rewards and redemption codes are treated as quota operations.')}
        icon={<ReceiptText className='size-4' aria-hidden='true' />}
        tone='warning'
      />
    </section>
  )
}
