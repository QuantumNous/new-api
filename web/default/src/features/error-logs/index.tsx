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
import { ErrorLogsTable } from './components/error-logs-table'

export function ErrorLogs() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Error Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('View and filter failed API requests for troubleshooting')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <ErrorLogsTable />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
