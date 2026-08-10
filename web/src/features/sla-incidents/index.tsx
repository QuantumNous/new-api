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

import { SlaIncidentsDialogs } from './components/sla-incidents-dialogs'
import { SlaIncidentsPrimaryButtons } from './components/sla-incidents-primary-buttons'
import { SlaIncidentsProvider } from './components/sla-incidents-provider'
import { SlaIncidentsTable } from './components/sla-incidents-table'

export function SlaIncidents() {
  const { t } = useTranslation()
  return (
    <SlaIncidentsProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('SLA Incidents')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <SlaIncidentsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <SlaIncidentsTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SlaIncidentsDialogs />
    </SlaIncidentsProvider>
  )
}
