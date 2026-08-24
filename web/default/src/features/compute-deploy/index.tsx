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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { BalanceBar } from './components/balance-bar'
import { DeployWizard } from './components/deploy-wizard'
import { GpuInstances } from './components/gpu-instances'
import { MyEndpoints } from './components/my-endpoints'

export function ComputeDeploy() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Compute')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <BalanceBar />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Tabs defaultValue='deploy' className='gap-4'>
          <TabsList>
            <TabsTrigger value='deploy'>{t('Deploy')}</TabsTrigger>
            <TabsTrigger value='endpoints'>{t('My Endpoints')}</TabsTrigger>
            <TabsTrigger value='instances'>
              {t('GPU Instances')}
              <Badge
                variant='secondary'
                className='ml-1 h-4 px-1.5 text-[10px] leading-none font-semibold'
              >
                {t('Coming soon')}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value='deploy'>
            <DeployWizard />
          </TabsContent>
          <TabsContent value='endpoints'>
            <MyEndpoints />
          </TabsContent>
          <TabsContent value='instances'>
            <GpuInstances />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
