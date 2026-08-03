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
import { useQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestampToDate } from '@/lib/format'

import { getTeam } from '../api'
import { TeamBillingTab } from './team-billing-tab'
import { TeamMembersTab } from './team-members-tab'
import { TeamProjectsTab } from './team-projects-tab'

const route = getRouteApi('/_authenticated/teams/$teamId/')

export function TeamDetail() {
  const { t } = useTranslation()
  const { teamId } = route.useParams()
  const id = Number(teamId)

  const { data: team } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      const result = await getTeam(id)
      return result.success ? (result.data ?? null) : null
    },
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{team?.name ?? t('Team')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' size='sm' render={<Link to='/teams' />}>
          <ArrowLeft className='h-4 w-4' />
          {t('Back')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
          {team && (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
              <div>
                <div className='text-muted-foreground text-sm'>
                  {t('Description')}
                </div>
                <div className='mt-1 text-sm'>{team.description || '-'}</div>
              </div>
              <div>
                <div className='text-muted-foreground text-sm'>
                  {t('Owner User ID')}
                </div>
                <div className='mt-1 tabular-nums'>{team.owner_id}</div>
              </div>
              <div>
                <div className='text-muted-foreground text-sm'>
                  {t('Created At')}
                </div>
                <div className='mt-1 text-sm'>
                  {team.created_at > 0
                    ? formatTimestampToDate(team.created_at)
                    : '-'}
                </div>
              </div>
            </div>
          )}
          <Tabs defaultValue='members'>
            <TabsList>
              <TabsTrigger value='members'>{t('Members')}</TabsTrigger>
              <TabsTrigger value='projects'>{t('Projects')}</TabsTrigger>
              <TabsTrigger value='billing'>{t('Billing')}</TabsTrigger>
            </TabsList>
            <TabsContent value='members' className='pt-4'>
              <TeamMembersTab teamId={id} />
            </TabsContent>
            <TabsContent value='projects' className='pt-4'>
              <TeamProjectsTab teamId={id} />
            </TabsContent>
            <TabsContent value='billing' className='pt-4'>
              <TeamBillingTab teamId={id} />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
