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

import { RegionRoutesDialogs } from './components/region-routes-dialogs'
import { RegionRoutesPrimaryButtons } from './components/region-routes-primary-buttons'
import { RegionRoutesProvider } from './components/region-routes-provider'
import { RegionRoutesTable } from './components/region-routes-table'

export function RegionRoutes() {
  const { t } = useTranslation()
  return (
    <RegionRoutesProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Region Routes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <RegionRoutesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <RegionRoutesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <RegionRoutesDialogs />
    </RegionRoutesProvider>
  )
}
