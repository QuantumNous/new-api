import { AppHeader, Main } from '@/components/layout'
import { ChannelsDialogs } from './components/channels-dialogs'
import { ChannelsPrimaryButtons } from './components/channels-primary-buttons'
import { ChannelsProvider } from './components/channels-provider'
import { ChannelsTable } from './components/channels-table'

export function Channels() {
  return (
    <ChannelsProvider>
      <AppHeader fixed />

      <Main>
        <div className='space-y-4'>
          {/* Header: Title + Actions */}
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>Channels</h2>
              <p className='text-muted-foreground text-sm'>
                Manage API channels and provider configurations
              </p>
            </div>
            <ChannelsPrimaryButtons />
          </div>

          {/* Table with integrated filters */}
          <ChannelsTable />
        </div>
      </Main>

      <ChannelsDialogs />
    </ChannelsProvider>
  )
}
