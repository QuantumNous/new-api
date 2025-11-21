import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { ApiKeysDialogs } from './components/api-keys-dialogs'
import { ApiKeysPrimaryButtons } from './components/api-keys-primary-buttons'
import { ApiKeysProvider } from './components/api-keys-provider'
import { ApiKeysTable } from './components/api-keys-table'

export function ApiKeys() {
  const { t } = useTranslation()
  return (
    <ApiKeysProvider>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {t('API Keys')}
            </h2>
            <p className='text-muted-foreground'>
              {t('Manage your API keys for accessing the service')}
            </p>
          </div>
          <ApiKeysPrimaryButtons />
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <ApiKeysTable />
        </div>
      </Main>

      <ApiKeysDialogs />
    </ApiKeysProvider>
  )
}
