import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
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
import {
  type ModelsSectionId,
  MODELS_DEFAULT_SECTION,
  MODELS_SECTION_IDS,
} from './section-registry'

const route = getRouteApi('/_authenticated/models/$section')

const SECTION_META: Record<
  ModelsSectionId,
  { titleKey: string; descriptionKey: string }
> = {
  metadata: {
    titleKey: 'Metadata',
    descriptionKey: 'Manage model metadata and configuration',
  },
  deployments: {
    titleKey: 'Deployments',
    descriptionKey: 'Manage model deployments',
  },
}

function ModelsContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tabCategory, setTabCategory } = useModels()
  const params = route.useParams()
  const activeSection = (params.section ??
    MODELS_DEFAULT_SECTION) as ModelsSectionId

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
    if (
      activeSection === 'deployments' &&
      isIoNetEnabled &&
      loadingPhase === 'connection'
    ) {
      const defaultParams = { p: 1, page_size: 10 }
      queryClient.prefetchQuery({
        queryKey: deploymentsQueryKeys.list(defaultParams),
        queryFn: () => listDeployments(defaultParams),
        staleTime: 30 * 1000, // 30 seconds
      })
    }
  }, [activeSection, isIoNetEnabled, loadingPhase, queryClient])

  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/models/$section',
        params: { section: section as ModelsSectionId },
      })
    },
    [navigate]
  )

  const meta = SECTION_META[activeSection] ?? SECTION_META.metadata

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(meta.descriptionKey)}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          {activeSection === 'metadata' ? (
            <ModelsPrimaryButtons />
          ) : (
            <Button onClick={() => setCreateDeploymentOpen(true)} size='sm'>
              <Plus className='h-4 w-4' />
              {t('Create deployment')}
            </Button>
          )}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            <Tabs value={activeSection} onValueChange={handleSectionChange}>
              <TabsList className='h-auto max-w-full flex-wrap justify-start'>
                {MODELS_SECTION_IDS.map((section) => (
                  <TabsTrigger key={section} value={section}>
                    {t(SECTION_META[section].titleKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
        </SectionPageLayout.Content>
      </SectionPageLayout>

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
