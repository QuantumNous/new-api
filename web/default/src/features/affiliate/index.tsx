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
import { SectionPageLayout } from '@/components/layout'
import { AffiliateCommissionsCard } from '@/features/wallet/components/affiliate-commissions-card'
import { PayoutProfileCard } from './components/payout-profile-card'

export function Affiliate() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Affiliate')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Manage PayPal payout account and top-up commission ledger')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          <PayoutProfileCard />

          <AffiliateCommissionsCard />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
