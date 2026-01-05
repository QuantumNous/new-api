import { useCallback, useEffect } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { DeploymentAccessGuard } from './components/deployment-access-guard'
import { DeploymentsTable } from './components/deployments-table'
import { ModelsDialogs } from './components/models-dialogs'
import { ModelsPrimaryButtons } from './components/models-primary-buttons'
import { ModelsProvider, useModels } from './components/models-provider'
import { ModelsTable } from './components/models-table'
import { ModelsTabs } from './components/models-tabs'
import { useModelDeploymentSettings } from './hooks/use-model-deployment-settings'

const route = getRouteApi('/_authenticated/models/')

function ModelsContent() {
  const { t } = useTranslation()
  const { tabCategory, setTabCategory } = useModels()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const activeTab = (search.tab ?? 'metadata') as 'metadata' | 'deployments'

  // keep context state in sync (for components that rely on it)
  useEffect(() => {
    if (tabCategory !== activeTab) {
      setTabCategory(activeTab)
    }
  }, [activeTab, setTabCategory, tabCategory])

  const setActiveTab = useCallback(
    (tab: 'metadata' | 'deployments') => {
      setTabCategory(tab)
      navigate({
        search: (prev) => ({
          ...prev,
          tab: tab === 'metadata' ? undefined : tab,
        }),
        replace: true,
      })
    },
    [navigate, setTabCategory]
  )

  const {
    loading: deploymentLoading,
    isIoNetEnabled,
    connectionLoading,
    connectionOk,
    connectionError,
    testConnection,
    refresh: refreshDeploymentSettings,
  } = useModelDeploymentSettings()

  // Ensure settings are fresh when switching to deployments tab
  useEffect(() => {
    if (activeTab === 'deployments') {
      refreshDeploymentSettings()
    }
  }, [activeTab, refreshDeploymentSettings])

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
              <h2 className='text-2xl font-bold tracking-tight'>
                {t('Models')}
              </h2>
              <div className='w-full sm:w-auto'>
                <ModelsTabs value={activeTab} onValueChange={setActiveTab} />
              </div>
            </div>
            <p className='text-muted-foreground'>
              {t('Manage model metadata and deployments')}
            </p>
          </div>
          {activeTab === 'metadata' && <ModelsPrimaryButtons />}
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          {activeTab === 'metadata' ? (
            <ModelsTable />
          ) : (
            <DeploymentAccessGuard
              loading={deploymentLoading}
              isEnabled={isIoNetEnabled}
              connectionLoading={connectionLoading}
              connectionOk={connectionOk}
              connectionError={connectionError}
              onRetry={testConnection}
            >
              <DeploymentsTable />
            </DeploymentAccessGuard>
          )}
        </div>
      </Main>

      <ModelsDialogs />
    </>
  )
}

export function Models() {
  return (
    <ModelsProvider>
      <ModelsContent />
    </ModelsProvider>
  )
}
