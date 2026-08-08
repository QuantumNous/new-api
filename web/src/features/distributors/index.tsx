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
*/
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { DistributorsDialogs } from './components/distributors-dialogs'
import { DistributorsPrimaryButtons } from './components/distributors-primary-buttons'
import { DistributorsProvider } from './components/distributors-provider'
import { DistributorsTable } from './components/distributors-table'

export function Distributors() {
  const { t } = useTranslation()
  return (
    <DistributorsProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Distributors')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <DistributorsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <DistributorsTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <DistributorsDialogs />
    </DistributorsProvider>
  )
}
