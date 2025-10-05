import { AppHeader, Main } from '@/components/layout'
import { RedemptionsDialogs } from './components/redemptions-dialogs'
import { RedemptionsPrimaryButtons } from './components/redemptions-primary-buttons'
import { RedemptionsProvider } from './components/redemptions-provider'
import { RedemptionsTable } from './components/redemptions-table'

export function Redemptions() {
  return (
    <RedemptionsProvider>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Redemption Codes
            </h2>
            <p className='text-muted-foreground'>
              Manage redemption codes for quota top-up
            </p>
          </div>
          <RedemptionsPrimaryButtons />
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <RedemptionsTable />
        </div>
      </Main>

      <RedemptionsDialogs />
    </RedemptionsProvider>
  )
}
