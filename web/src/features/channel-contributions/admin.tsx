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
import { Link } from '@tanstack/react-router'
import { HeartHandshake, ListChecks, Settings, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AdminContributionDetail } from './components/admin-contribution-detail'
import { AdminContributionList } from './components/admin-contribution-list'
import { AdminContributionSettings } from './components/admin-contribution-settings'

type AdminTab = 'pending' | 'all' | 'settings'

export function ChannelContributionAdmin() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<AdminTab>('pending')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Channel Contribution Review')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            render={<Link to='/channel-contributions' />}
          >
            <UserRound data-icon='inline-start' />
            {t('User contribution view')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-7xl space-y-4'>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as AdminTab)}
            >
              <div className='max-w-full overflow-x-auto'>
                <TabsList className='w-max min-w-full sm:min-w-0'>
                  <TabsTrigger className='whitespace-nowrap' value='pending'>
                    <ListChecks aria-hidden='true' />
                    {t('Pending review')}
                  </TabsTrigger>
                  <TabsTrigger className='whitespace-nowrap' value='all'>
                    <HeartHandshake aria-hidden='true' />
                    {t('All contributions')}
                  </TabsTrigger>
                  <TabsTrigger className='whitespace-nowrap' value='settings'>
                    <Settings aria-hidden='true' />
                    {t('Settings')}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value='pending' className='mt-2'>
                <AdminContributionList
                  status='pending'
                  title={t('Pending review')}
                  description={t(
                    'Verify every current revision independently before approval.'
                  )}
                  onReview={setSelectedId}
                />
              </TabsContent>

              <TabsContent value='all' className='mt-2'>
                <AdminContributionList
                  title={t('All contributions')}
                  description={t(
                    'Inspect drafts, approved channels, rejected revisions, and health removals.'
                  )}
                  onReview={setSelectedId}
                />
              </TabsContent>

              <TabsContent value='settings' className='mt-2'>
                <AdminContributionSettings />
              </TabsContent>
            </Tabs>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {selectedId ? (
        <AdminContributionDetail
          key={selectedId}
          id={selectedId}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedId(null)
          }}
        />
      ) : null}
    </>
  )
}
