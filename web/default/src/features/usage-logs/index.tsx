import { useCallback, useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import type { NavGroup } from '@/components/layout/types'
import { CacheStatsDialog } from '@/features/system-settings/general/channel-affinity/cache-stats-dialog'
import { UserInfoDialog } from './components/dialogs/user-info-dialog'
import {
  UsageLogsProvider,
  useUsageLogsContext,
} from './components/usage-logs-provider'
import { UsageLogsTable } from './components/usage-logs-table'
import {
  isUsageLogsSectionId,
  USAGE_LOGS_DEFAULT_SECTION,
  type UsageLogsSectionId,
} from './section-registry'

const route = getRouteApi('/_authenticated/usage-logs/$section')
const TASK_LOG_SECTIONS = ['drawing', 'task'] as const

const SECTION_META: Record<
  UsageLogsSectionId,
  { titleKey: string; descriptionKey: string }
> = {
  common: {
    titleKey: 'Common Logs',
    descriptionKey: 'View and manage your API usage logs',
  },
  drawing: {
    titleKey: 'Drawing Logs',
    descriptionKey: 'View and manage your drawing logs',
  },
  task: {
    titleKey: 'Task Logs',
    descriptionKey: 'View and manage your task logs',
  },
}

function UsageLogsContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const activeCategory: UsageLogsSectionId =
    params.section && isUsageLogsSectionId(params.section)
      ? params.section
      : USAGE_LOGS_DEFAULT_SECTION
  const {
    selectedUserId,
    userInfoDialogOpen,
    setUserInfoDialogOpen,
    affinityTarget,
    affinityDialogOpen,
    setAffinityDialogOpen,
  } = useUsageLogsContext()
  const tabNavGroups = useMemo<NavGroup[]>(
    () => [
      {
        title: 'Task Logs',
        items: TASK_LOG_SECTIONS.map((section) => ({
          title: SECTION_META[section].titleKey,
          url: `/usage-logs/${section}`,
        })),
      },
    ],
    []
  )
  const filteredTabGroups = useSidebarConfig(tabNavGroups)
  const visibleSections = useMemo(
    () =>
      (filteredTabGroups[0]?.items ?? [])
        .map((item) => {
          if (!('url' in item) || typeof item.url !== 'string') return null
          return item.url.split('/').pop() ?? null
        })
        .filter(
          (section): section is UsageLogsSectionId =>
            Boolean(section && isUsageLogsSectionId(section))
        ),
    [filteredTabGroups]
  )

  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/usage-logs/$section',
        params: { section: section as UsageLogsSectionId },
      })
    },
    [navigate]
  )

  const pageMeta =
    activeCategory === 'common' ? SECTION_META.common : SECTION_META.task
  const showTaskSwitcher =
    activeCategory !== 'common' && visibleSections.length > 1

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t(pageMeta.titleKey)}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(pageMeta.descriptionKey)}
        </SectionPageLayout.Description>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            {showTaskSwitcher && (
              <Tabs value={activeCategory} onValueChange={handleSectionChange}>
                <TabsList className='h-auto max-w-full flex-wrap justify-start'>
                  {visibleSections.map((section) => (
                    <TabsTrigger key={section} value={section}>
                      {t(SECTION_META[section].titleKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <UsageLogsTable logCategory={activeCategory} />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <UserInfoDialog
        userId={selectedUserId}
        open={userInfoDialogOpen}
        onOpenChange={setUserInfoDialogOpen}
      />

      <CacheStatsDialog
        open={affinityDialogOpen}
        onOpenChange={setAffinityDialogOpen}
        target={
          affinityTarget
            ? {
                rule_name: affinityTarget.rule_name || '',
                using_group:
                  affinityTarget.using_group ||
                  affinityTarget.selected_group ||
                  '',
                key_hint: affinityTarget.key_hint || '',
                key_fp: affinityTarget.key_fp || '',
              }
            : null
        }
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
