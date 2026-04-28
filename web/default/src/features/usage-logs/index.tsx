import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { CacheStatsDialog } from '@/features/system-settings/general/channel-affinity/cache-stats-dialog'
import { CommonLogsStats } from './components/common-logs-stats'
import { UserInfoDialog } from './components/dialogs/user-info-dialog'
import { UsageLogsPrimaryButtons } from './components/usage-logs-primary-buttons'
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

function UsageLogsContent() {
  const { t } = useTranslation()
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

  const title =
    activeCategory === 'common'
      ? t('Common Logs')
      : activeCategory === 'drawing'
        ? t('Drawing Logs')
        : activeCategory === 'task'
          ? t('Task Logs')
          : t('Usage Logs')

  const description =
    activeCategory === 'common'
      ? t('View and manage your API usage logs')
      : activeCategory === 'drawing'
        ? t('View and manage your drawing logs')
        : activeCategory === 'task'
          ? t('View and manage your task logs')
          : t('View and manage your API usage logs')

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{title}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {description}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          {activeCategory === 'common' && <CommonLogsStats />}
          <UsageLogsPrimaryButtons logCategory={activeCategory} />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <UsageLogsTable logCategory={activeCategory} />
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
