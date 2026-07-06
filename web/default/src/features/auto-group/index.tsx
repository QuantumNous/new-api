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

import { ProtectedGroupsConfig } from './components/protected-groups-config'
import { ResolveTest } from './components/resolve-test'
import { RulesDialogs } from './components/rules-dialogs'
import { RulesPrimaryButtons } from './components/rules-primary-buttons'
import { RulesProvider } from './components/rules-provider'
import { RulesTable } from './components/rules-table'

export function AutoGroupRules() {
  const { t } = useTranslation()
  return (
    <RulesProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Auto Group Rules')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <RulesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-3'>
            <div className='grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2'>
              <ProtectedGroupsConfig />
              <ResolveTest />
            </div>
            <div className='min-h-0 flex-1'>
              <RulesTable />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <RulesDialogs />
    </RulesProvider>
  )
}
