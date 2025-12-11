import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { ChannelsDialogs } from './components/channels-dialogs'
import { ChannelsPrimaryButtons } from './components/channels-primary-buttons'
import { ChannelsProvider } from './components/channels-provider'
import { ChannelsTable } from './components/channels-table'

export function Channels() {
  const { t } = useTranslation()
  return (
    <ChannelsProvider>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {t('Channels')}
            </h2>
            <p className='text-muted-foreground'>
              {t('Manage API channels and provider configurations')}
            </p>
          </div>
          <ChannelsPrimaryButtons />
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <ChannelsTable />
        </div>
      </Main>

      <ChannelsDialogs />
    </ChannelsProvider>
  )
}
