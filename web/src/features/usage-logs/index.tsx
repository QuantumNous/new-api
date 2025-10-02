import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { UsageLogsProvider } from './components/usage-logs-provider'
import { UsageLogsTable } from './components/usage-logs-table'

export function UsageLogs() {
  return (
    <UsageLogsProvider>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Usage Logs</h2>
            <p className='text-muted-foreground'>
              View and manage your API usage logs, including consumption,
              errors, and more
            </p>
          </div>
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <UsageLogsTable />
        </div>
      </Main>
    </UsageLogsProvider>
  )
}
