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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { IdentityRules } from './components/identity-rules'
import { ProtectedGroupsConfig } from './components/protected-groups-config'
import { SuggestionsTable } from './components/suggestions-table'
import { WorkspaceDashboard } from './components/workspace-dashboard'

export function AutoGroupRules() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Auto Group Workspace')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs defaultValue='overview' className='flex h-full min-h-0 flex-col gap-4'>
          <TabsList className='w-fit'>
            <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
            <TabsTrigger value='pending'>{t('Pending users')}</TabsTrigger>
            <TabsTrigger value='rules'>{t('Identity rules')}</TabsTrigger>
            <TabsTrigger value='protected'>{t('Protected groups')}</TabsTrigger>
          </TabsList>
          <TabsContent value='overview' className='min-h-0 flex-1'>
            <WorkspaceDashboard />
          </TabsContent>
          <TabsContent value='pending' className='min-h-0 flex-1'>
            <SuggestionsTable />
          </TabsContent>
          <TabsContent value='rules' className='min-h-0 flex-1'>
            <IdentityRules />
          </TabsContent>
          <TabsContent value='protected' className='min-h-0 flex-1'>
            <ProtectedGroupsConfig />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
