/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { RefreshCw, Download } from 'lucide-react'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
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
import { getLogStats, getUserLogStats } from './api'
import { useAuthStore } from '@/stores/auth-store'
import { formatLogQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'

const route = getRouteApi('/_authenticated/usage-logs/$section')
const TASK_LOG_SECTIONS = ['drawing', 'task'] as const

const SECTION_META: Record<UsageLogsSectionId, { titleKey: string }> = {
  common: {
    titleKey: 'Common Logs',
  },
  drawing: {
    titleKey: 'Drawing Logs',
  },
  task: {
    titleKey: 'Task Logs',
  },
}

function StatCard({
  label,
  value,
  change,
  changeType,
}: {
  label: string
  value: string
  change?: string
  changeType?: 'up' | 'down'
}) {
  return (
    <div className='rounded-[8px] border border-border bg-card px-4 py-4 shadow-sm'>
      <div className='text-muted-foreground text-xs font-medium'>{label}</div>
      <div className='text-foreground mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums'>
        {value}
      </div>
      {change && (
        <div
          className={`mt-1 text-xs font-medium ${
            changeType === 'up' ? 'text-success' : 'text-destructive'
          }`}
        >
          {change}
        </div>
      )}
    </div>
  )
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
        .filter((section): section is UsageLogsSectionId =>
          Boolean(section && isUsageLogsSectionId(section))
        ),
    [filteredTabGroups]
  )

  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.OPERATOR)
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return Math.floor(d.getTime() / 1000)
  }, [])

  const { data: stats } = useQuery({
    queryKey: ['default-usage-logs-stats', isAdmin, todayStart],
    queryFn: async () => {
      const params = { start_timestamp: todayStart, type: 2 }
      const result = isAdmin
        ? await getLogStats(params)
        : await getUserLogStats(params)
      return result.success ? result.data : null
    },
    placeholderData: (prev) => prev,
  })

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
        <SectionPageLayout.Title>
          {t(pageMeta.titleKey)}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(
            'Real-time call audit and consumption tracking · Data delay about 30 seconds'
          )}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => toast.info(t('Data refreshed'))}
            >
              <RefreshCw className='mr-1.5 size-3.5' />
              {t('Refresh')}
            </Button>
            <Button
              size='sm'
              onClick={() => toast.success(t('Exporting logs...'))}
            >
              <Download className='mr-1.5 size-3.5' />
              {t('Export CSV')}
            </Button>
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            {/* Stat cards */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
              <StatCard
                label={t("Today's Calls")}
                value={stats?.quota != null ? String(stats.quota) : '--'}
              />
              <StatCard
                label={t('Tokens Consumed')}
                value={stats?.tpm != null ? String(stats.tpm) : '--'}
              />
              <StatCard
                label={t('Cost')}
                value={stats?.quota != null ? formatLogQuota(stats.quota) : '--'}
              />
              <StatCard label={t('Error Rate')} value='--' />
              <StatCard label={t('Active Users')} value='--' />
              <StatCard label={t('Avg Response')} value='--' />
            </div>

            {showTaskSwitcher && (
              <Tabs value={activeCategory} onValueChange={handleSectionChange}>
                <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
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
