import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppHeader, Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { listDeployments } from './api'
import { DeploymentAccessGuard } from './components/deployment-access-guard'
import { DeploymentsTable } from './components/deployments-table'
import { CreateDeploymentDrawer } from './components/dialogs/create-deployment-drawer'
import { ModelsDialogs } from './components/models-dialogs'
import { ModelsPrimaryButtons } from './components/models-primary-buttons'
import { ModelsProvider, useModels } from './components/models-provider'
import { ModelsTable } from './components/models-table'
import { useModelDeploymentSettings } from './hooks/use-model-deployment-settings'
import { deploymentsQueryKeys } from './lib'
import type { ModelsSectionId } from './section-registry'
import { MODELS_DEFAULT_SECTION } from './section-registry'

const route = getRouteApi('/_authenticated/models/')

function ModelsContent() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { tabCategory, setTabCategory } = useModels()
  const search = route.useSearch()
  const activeSection = (search.section ?? MODELS_DEFAULT_SECTION) as ModelsSectionId

  // Deployment create dialog state
  const [createDeploymentOpen, setCreateDeploymentOpen] = useState(false)

  // keep context state in sync (for components that rely on it)
  useEffect(() => {
    if (tabCategory !== activeSection) {
      setTabCategory(activeSection)
    }
  }, [activeSection, setTabCategory, tabCategory])

  const {
    loading: deploymentLoading,
    loadingPhase,
    isIoNetEnabled,
    connectionLoading,
    connectionOk,
    connectionError,
    testConnection,
    refresh: refreshDeploymentSettings,
  } = useModelDeploymentSettings()

  // Ensure settings are fresh when switching to deployments section
  useEffect(() => {
    if (activeSection === 'deployments') {
      refreshDeploymentSettings()
    }
  }, [activeSection, refreshDeploymentSettings])

  // Prefetch deployments list while connection check is in progress
  // This allows the data to be ready as soon as the guard passes
  useEffect(() => {
    if (activeSection === 'deployments' && isIoNetEnabled && loadingPhase === 'connection') {
      const defaultParams = { p: 1, page_size: 10 }
      queryClient.prefetchQuery({
        queryKey: deploymentsQueryKeys.list(defaultParams),
        queryFn: () => listDeployments(defaultParams),
        staleTime: 30 * 1000, // 30 seconds
      })
    }
  }, [activeSection, isIoNetEnabled, loadingPhase, queryClient])

  return (
    <>
      <AppHeader fixed />

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {activeSection === 'metadata' ? t('Metadata') : t('Deployments')}
            </h2>
            <p className='text-muted-foreground'>
              {activeSection === 'metadata'
                ? t('Manage model metadata and configuration')
                : t('Manage model deployments')}
            </p>
          </div>
          {activeSection === 'metadata' ? (
            <ModelsPrimaryButtons />
          ) : (
            <Button onClick={() => setCreateDeploymentOpen(true)} size='sm'>
              <Plus className='h-4 w-4' />
              {t('Create deployment')}
            </Button>
          )}
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          {activeSection === 'metadata' ? (
            <ModelsTable />
          ) : (
            <DeploymentAccessGuard
              loading={deploymentLoading}
              loadingPhase={loadingPhase}
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
      <CreateDeploymentDrawer
        open={createDeploymentOpen}
        onOpenChange={setCreateDeploymentOpen}
      />
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
