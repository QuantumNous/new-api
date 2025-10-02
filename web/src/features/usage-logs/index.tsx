import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { CommonLogsStats } from './components/common-logs-stats'
import { UserInfoDialog } from './components/dialogs/user-info-dialog'
import { UsageLogsPrimaryButtons } from './components/usage-logs-primary-buttons'
import {
  UsageLogsProvider,
  useUsageLogsContext,
} from './components/usage-logs-provider'
import { UsageLogsTable } from './components/usage-logs-table'

function UsageLogsContent() {
  const {
    selectedUserId,
    userInfoDialogOpen,
    setUserInfoDialogOpen,
    logCategory,
  } = useUsageLogsContext()

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2'>
          <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
              <h2 className='text-2xl font-bold tracking-tight'>Usage Logs</h2>
              {logCategory === 'common' && <CommonLogsStats />}
            </div>
            <UsageLogsPrimaryButtons />
          </div>
          <p className='text-muted-foreground'>
            View and manage your API usage logs, including consumption, errors,
            and more
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
