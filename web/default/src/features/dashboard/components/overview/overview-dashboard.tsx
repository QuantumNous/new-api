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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleGauge,
  CreditCard,
  FileText,
  KeyRound,
  Play,
  RadioTower,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiKeys } from '@/features/keys/api'
import { useStatus } from '@/hooks/use-status'
import { getUserModels } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useAnnouncements,
  useApiInfo,
  useDashboardContentVisibility,
} from '../../hooks/use-status-data'
import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'
import { PerformanceHealthPanel } from './performance-health-panel'
import { SummaryCards } from './summary-cards'

type DashboardActionPath = '/keys' | '/wallet' | '/playground'
type OverviewPanelKey = 'performance' | 'announcements' | 'api-info'

interface OverviewSignal {
  label: string
  value: string
  icon: LucideIcon
  loading?: boolean
}

interface NextAction {
  title: string
  to: DashboardActionPath
  icon: LucideIcon
}

function OverviewToolbar(props: {
  signals: OverviewSignal[]
  online: boolean
  statusLoading: boolean
}) {
  const { t } = useTranslation()

  let statusLabel = t('No data')
  if (props.statusLoading) {
    statusLabel = t('Loading...')
  } else if (props.online) {
    statusLabel = t('All systems operational')
  }

  return (
    <section className='bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl px-4 py-3 ring-1 sm:px-5 sm:py-3.5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              props.online ? 'bg-success' : 'bg-muted-foreground/45',
              props.online && 'motion-safe:animate-pulse'
            )}
            aria-hidden='true'
          />
          <span className='text-muted-foreground truncate text-xs font-medium sm:text-sm'>
            {statusLabel}
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          <Button size='sm' render={<Link to='/playground' />}>
            <Play data-icon='inline-start' />
            {t('Playground')}
          </Button>
          <Button variant='outline' size='sm' render={<Link to='/keys' />}>
            <KeyRound data-icon='inline-start' />
            {t('API Keys')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='hidden sm:inline-flex'
            render={<Link to='/usage-logs' />}
          >
            <FileText data-icon='inline-start' />
            {t('Usage Logs')}
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        {props.signals.map((signal) => {
          const Icon = signal.icon
          return (
            <div
              key={signal.label}
              className='bg-muted/45 text-muted-foreground inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs'
            >
              <Icon
                className='size-3.5 shrink-0 opacity-70'
                aria-hidden='true'
              />
              <span className='truncate font-medium'>{signal.label}</span>
              {signal.loading ? (
                <Skeleton className='h-3.5 w-10' />
              ) : (
                <span
                  className='text-foreground truncate font-mono font-semibold tabular-nums'
                  title={signal.value}
                >
                  {signal.value}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function NextActionBar(props: { action: NextAction }) {
  const { t } = useTranslation()
  const Icon = props.action.icon

  return (
    <Link
      to={props.action.to}
      className='bg-card ring-foreground/10 group hover:bg-muted/30 flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors'
    >
      <span className='bg-muted/60 text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg'>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
        {props.action.title}
      </span>
      <span className='text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors'>
        {t('Open')}
        <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5' />
      </span>
    </Link>
  )
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading: statusLoading } = useStatus()
  const { items: apiInfoItems, loading: apiInfoLoading } = useApiInfo()
  const { items: announcementItems } = useAnnouncements()
  const { apiInfo: showApiInfoPanel, announcements: showAnnouncementsPanel } =
    useDashboardContentVisibility()

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 10 })
      return result.success ? result.data : undefined
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = await getUserModels()
      return result.success ? (result.data ?? []) : null
    },
    staleTime: 5 * 60 * 1000,
  })

  const apiKeys = apiKeysQuery.data?.items ?? []
  const preferredKey =
    apiKeys.find((item) => item.status === 1) ?? apiKeys[0] ?? null
  const requestCount = Number(user?.request_count ?? 0)
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const signals: OverviewSignal[] = [
    {
      label: t('API Keys'),
      value:
        apiKeysQuery.data?.total === undefined
          ? t('No data')
          : formatNumber(apiKeysQuery.data.total),
      icon: KeyRound,
      loading: apiKeysQuery.isLoading,
    },
    {
      label: t('Available Models'),
      value:
        modelsQuery.data === null || modelsQuery.data === undefined
          ? t('No data')
          : formatNumber(modelsQuery.data.length),
      icon: CircleGauge,
      loading: modelsQuery.isLoading,
    },
    {
      label: t('Endpoint'),
      value: apiInfoItems[0]?.route || t('Current domain'),
      icon: RadioTower,
      loading: apiInfoLoading,
    },
  ]

  let nextAction: NextAction | null = null
  if (apiKeysQuery.data && user) {
    if (!preferredKey) {
      nextAction = {
        title: t('Create API Key'),
        to: '/keys',
        icon: KeyRound,
      }
    } else if (remainQuota <= 0 && usedQuota <= 0) {
      nextAction = {
        title: t('Add credits'),
        to: '/wallet',
        icon: CreditCard,
      }
    } else if (requestCount <= 0) {
      nextAction = {
        title: t('Send a request'),
        to: '/playground',
        icon: Play,
      }
    }
  }

  const panelKeys: OverviewPanelKey[] = []
  if (isAdmin) panelKeys.push('performance')
  if (showAnnouncementsPanel && announcementItems.length > 0) {
    panelKeys.push('announcements')
  }
  if (showApiInfoPanel && apiInfoItems.length > 0) {
    panelKeys.push('api-info')
  }
  const visiblePanels = panelKeys.slice(0, 2)

  return (
    <div className='flex flex-col gap-3 sm:gap-4'>
      <CardStaggerContainer>
        <CardStaggerItem>
          <OverviewToolbar
            signals={signals}
            online={Boolean(status)}
            statusLoading={statusLoading}
          />
        </CardStaggerItem>
      </CardStaggerContainer>

      {nextAction && (
        <CardStaggerContainer>
          <CardStaggerItem>
            <NextActionBar action={nextAction} />
          </CardStaggerItem>
        </CardStaggerContainer>
      )}

      <SummaryCards />

      {visiblePanels.length > 0 && (
        <CardStaggerContainer
          className={cn(
            'grid grid-cols-1 gap-3 sm:gap-4',
            visiblePanels.length > 1 && 'lg:grid-cols-2'
          )}
        >
          {visiblePanels.map((panel) => {
            if (panel === 'performance') {
              return (
                <CardStaggerItem key={panel} className='min-w-0'>
                  <PerformanceHealthPanel />
                </CardStaggerItem>
              )
            }
            if (panel === 'announcements') {
              return (
                <CardStaggerItem key={panel} className='min-w-0'>
                  <AnnouncementsPanel />
                </CardStaggerItem>
              )
            }
            return (
              <CardStaggerItem key={panel} className='min-w-0'>
                <ApiInfoPanel />
              </CardStaggerItem>
            )
          })}
        </CardStaggerContainer>
      )}
    </div>
  )
}
