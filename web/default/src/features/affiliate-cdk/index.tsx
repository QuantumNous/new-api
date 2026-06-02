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
import { AffiliateCdkCodesTable } from './components/affiliate-cdk-codes-table'
import { AffiliateCdkPurchaseCard } from './components/affiliate-cdk-purchase-card'

export function AffiliateCdk() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('CDK Procurement')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Purchase CDKs at your affiliate price and manage generated codes.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='grid w-full gap-4 sm:gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] xl:items-start'>
          <div className='min-w-0'>
            <AffiliateCdkPurchaseCard />
          </div>
          <div className='min-w-0'>
            <AffiliateCdkCodesTable />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
