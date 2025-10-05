import { useEffect } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { AppHeader, Main } from '@/components/layout'
import { CommonLogsStats } from './components/common-logs-stats'
import { UserInfoDialog } from './components/dialogs/user-info-dialog'
import { UsageLogsPrimaryButtons } from './components/usage-logs-primary-buttons'
import {
  UsageLogsProvider,
  useUsageLogsContext,
} from './components/usage-logs-provider'
import { UsageLogsTable } from './components/usage-logs-table'

const route = getRouteApi('/_authenticated/usage-logs/')

function UsageLogsContent() {
  const searchParams = route.useSearch()
  const {
    selectedUserId,
    userInfoDialogOpen,
    setUserInfoDialogOpen,
    logCategory,
    setLogCategory,
  } = useUsageLogsContext()

  // Sync tab state with URL parameter
  useEffect(() => {
    if (searchParams.tab && searchParams.tab !== logCategory) {
      setLogCategory(searchParams.tab as typeof logCategory)
    }
  }, [searchParams.tab, logCategory, setLogCategory])

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            <div className='flex w-full items-center justify-between sm:w-auto sm:justify-start'>
              <h2 className='text-2xl font-bold tracking-tight'>Usage Logs</h2>
              <div className='sm:hidden'>
                <UsageLogsPrimaryButtons />
              </div>
            </div>
            {logCategory === 'common' && (
              <div className='order-last sm:order-none'>
                <CommonLogsStats />
              </div>
            )}
            <div className='hidden sm:ml-auto sm:block'>
              <UsageLogsPrimaryButtons />
            </div>
          </div>
          <p className='text-muted-foreground'>
            View and manage your API usage logs
          </p>
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <UsageLogsTable />
        </div>
      </Main>

      <UserInfoDialog
        userId={selectedUserId}
        open={userInfoDialogOpen}
        onOpenChange={setUserInfoDialogOpen}
      />
    </>
  )
}

export function UsageLogs() {
  return (
    <UsageLogsProvider>
      <UsageLogsContent />
    </UsageLogsProvider>
  )
}
