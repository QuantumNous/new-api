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

import { ThirdPartySitesDialogs } from './components/third-party-sites-dialogs'
import { ThirdPartySitesPrimaryButtons } from './components/third-party-sites-primary-buttons'
import { ThirdPartySitesProvider } from './components/third-party-sites-provider'
import { ThirdPartySitesTable } from './components/third-party-sites-table'

export function ThirdPartySites() {
  const { t } = useTranslation()
  return (
    <ThirdPartySitesProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Third-Party Sites')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <ThirdPartySitesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <ThirdPartySitesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ThirdPartySitesDialogs />
    </ThirdPartySitesProvider>
  )
}
