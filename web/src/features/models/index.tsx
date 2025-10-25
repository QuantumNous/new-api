import { AppHeader, Main } from '@/components/layout'
import { ModelsDialogs } from './components/models-dialogs'
import { ModelsPrimaryButtons } from './components/models-primary-buttons'
import { ModelsProvider } from './components/models-provider'
import { ModelsTable } from './components/models-table'

export function Models() {
  return (
    <ModelsProvider>
      <AppHeader fixed />

      <Main>
        <div className='space-y-4'>
          {/* Header: Title + Actions */}
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>Models</h2>
              <p className='text-muted-foreground text-sm'>
                Manage AI model metadata and vendor configurations
              </p>
            </div>
            <ModelsPrimaryButtons />
          </div>

          {/* Table with integrated filters */}
          <ModelsTable />
        </div>
      </Main>

      <ModelsDialogs />
    </ModelsProvider>
  )
}
