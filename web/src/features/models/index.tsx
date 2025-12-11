import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { ModelsDialogs } from './components/models-dialogs'
import { ModelsPrimaryButtons } from './components/models-primary-buttons'
import { ModelsProvider } from './components/models-provider'
import { ModelsTable } from './components/models-table'

export function Models() {
  const { t } = useTranslation()
  return (
    <ModelsProvider>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>{t('Models')}</h2>
            <p className='text-muted-foreground'>
              {t('Manage AI model metadata and vendor configurations')}
            </p>
          </div>
          <ModelsPrimaryButtons />
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <ModelsTable />
        </div>
      </Main>

      <ModelsDialogs />
    </ModelsProvider>
  )
}
