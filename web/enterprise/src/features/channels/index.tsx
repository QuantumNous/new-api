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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { SectionPageLayout } from '@/components/layout'
import { ChannelsDialogs } from './components/channels-dialogs'
import { ChannelsPrimaryButtons } from './components/channels-primary-buttons'
import { ChannelsProvider } from './components/channels-provider'
import { ChannelsStats } from './components/channels-stats'
import { ChannelsTable } from './components/channels-table'
import { getChannels } from './api'
import { channelsQueryKeys } from './lib'

export function Channels() {
  const { t } = useTranslation()

  // Fetch all channels for stats computation (unpaginated)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: channelsQueryKeys.list({
      page_size: 9999,
      p: 1,
      id_sort: true,
    }),
    queryFn: () =>
      getChannels({
        page_size: 9999,
        p: 1,
        id_sort: true,
      }),
    staleTime: 30_000,
  })

  const allChannels = useMemo(
    () => statsData?.data?.items ?? [],
    [statsData]
  )
  const totalCount = statsData?.data?.total ?? 0

  return (
    <ChannelsProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Channels')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <ChannelsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-6'>
            <ChannelsStats
              channels={allChannels}
              total={totalCount}
              isLoading={statsLoading}
            />
            <ChannelsTable />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ChannelsDialogs />
    </ChannelsProvider>
  )
}
