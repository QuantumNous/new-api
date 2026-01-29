import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { CommonLogsStats } from './components/common-logs-stats'
import { UserInfoDialog } from './components/dialogs/user-info-dialog'
import { UsageLogsPrimaryButtons } from './components/usage-logs-primary-buttons'
import {
  UsageLogsProvider,
  useUsageLogsContext,
} from './components/usage-logs-provider'
import { UsageLogsTable } from './components/usage-logs-table'
import type { UsageLogsSectionId } from './section-registry'
import { USAGE_LOGS_DEFAULT_SECTION } from './section-registry'

const route = getRouteApi('/_authenticated/usage-logs/')

function UsageLogsContent() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const activeCategory = (search.section ??
    USAGE_LOGS_DEFAULT_SECTION) as UsageLogsSectionId
  const {
    selectedUserId,
    userInfoDialogOpen,
    setUserInfoDialogOpen,
  } = useUsageLogsContext()

  // Get title and description based on category
  const getTitle = () => {
    switch (activeCategory) {
      case 'common':
        return t('Common Logs')
      case 'drawing':
        return t('Drawing Logs')
      case 'task':
        return t('Task Logs')
      default:
        return t('Usage Logs')
    }
  }

  const getDescription = () => {
    switch (activeCategory) {
      case 'common':
        return t('View and manage your API usage logs')
      case 'drawing':
        return t('View and manage your drawing logs')
      case 'task':
        return t('View and manage your task logs')
      default:
        return t('View and manage your API usage logs')
    }
  }

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            <div className='flex w-full items-center justify-between sm:w-auto sm:justify-start'>
              <h2 className='text-2xl font-bold tracking-tight'>
                {getTitle()}
              </h2>
              <div className='sm:hidden'>
                <UsageLogsPrimaryButtons logCategory={activeCategory} />
              </div>
            </div>
            {activeCategory === 'common' && (
              <div className='order-last sm:order-none'>
                <CommonLogsStats />
              </div>
            )}
            <div className='hidden sm:ml-auto sm:block'>
              <UsageLogsPrimaryButtons logCategory={activeCategory} />
            </div>
          </div>
          <p className='text-muted-foreground'>{getDescription()}</p>
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <UsageLogsTable logCategory={activeCategory} />
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
