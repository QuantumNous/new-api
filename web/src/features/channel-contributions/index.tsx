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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Coins, HeartHandshake, History, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getChannelContribution, getChannelContributionConfig } from './api'
import { ContributionHistory } from './components/contribution-history'
import { ContributionRewards } from './components/contribution-rewards'
import { ContributionWorkspace } from './components/contribution-workspace'
import type { ChannelContribution } from './types'

type ContributionTab = 'contribute' | 'history' | 'rewards'

export function ChannelContributions() {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role ?? 0)
  const [tab, setTab] = useState<ContributionTab>('contribute')
  const [editingContribution, setEditingContribution] =
    useState<ChannelContribution | null>(null)
  const configQuery = useQuery({
    queryKey: ['channel-contributions', 'config'],
    queryFn: async () => {
      const response = await getChannelContributionConfig()
      if (!response.success || !response.data) {
        throw new Error(
          response.message || t('Failed to load contribution settings')
        )
      }
      return response.data
    },
  })

  const handleEdit = async (id: number) => {
    try {
      const response = await getChannelContribution(id)
      if (!response.success || !response.data) {
        toast.error(response.message || t('Failed to load contribution'))
        return
      }
      setEditingContribution(response.data)
      setTab('contribute')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load contribution')
      )
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Channel Contributions')}
      </SectionPageLayout.Title>
      {role >= ROLE.ADMIN ? (
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            render={<Link to='/channel-contributions/admin' />}
          >
            <ShieldCheck data-icon='inline-start' />
            {t('Review contributions')}
          </Button>
        </SectionPageLayout.Actions>
      ) : null}
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-7xl space-y-4'>
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as ContributionTab)}
          >
            <div className='max-w-full overflow-x-auto'>
              <TabsList className='w-max min-w-full sm:min-w-0'>
                <TabsTrigger className='whitespace-nowrap' value='contribute'>
                  <HeartHandshake aria-hidden='true' />
                  {t('Contribute')}
                </TabsTrigger>
                <TabsTrigger className='whitespace-nowrap' value='history'>
                  <History aria-hidden='true' />
                  {t('My contributions')}
                </TabsTrigger>
                <TabsTrigger className='whitespace-nowrap' value='rewards'>
                  <Coins aria-hidden='true' />
                  {t('Rewards')}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value='contribute' className='mt-2'>
              {configQuery.isLoading ? (
                <div className='text-muted-foreground flex min-h-64 items-center justify-center text-sm'>
                  {t('Loading...')}
                </div>
              ) : null}
              {!configQuery.isLoading &&
              (configQuery.error || !configQuery.data) ? (
                <Alert variant='destructive'>
                  <AlertTitle>
                    {t('Contribution settings unavailable')}
                  </AlertTitle>
                  <AlertDescription>
                    {configQuery.error instanceof Error
                      ? configQuery.error.message
                      : t('Failed to load contribution settings')}
                  </AlertDescription>
                </Alert>
              ) : null}
              {!configQuery.isLoading &&
              !configQuery.error &&
              configQuery.data ? (
                <ContributionWorkspace
                  config={configQuery.data}
                  initialContribution={editingContribution}
                  onStartNew={() => setEditingContribution(null)}
                  onChanged={setEditingContribution}
                  onSubmitted={(contribution) => {
                    setEditingContribution(contribution)
                    setTab('history')
                  }}
                />
              ) : null}
            </TabsContent>

            <TabsContent value='history' className='mt-2'>
              <ContributionHistory onEdit={handleEdit} />
            </TabsContent>

            <TabsContent value='rewards' className='mt-2'>
              <ContributionRewards
                rewardBps={configQuery.data?.reward_bps ?? 0}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
