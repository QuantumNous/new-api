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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
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
  tone: IconBadgeTone
  loading?: boolean
}

interface NextAction {
  title: string
  description: string
  to: DashboardActionPath
  icon: LucideIcon
}

function OverviewSignalCard(props: { signal: OverviewSignal }) {
  const Icon = props.signal.icon

  return (
    <div className='bg-background/65 flex min-w-0 items-center gap-3 rounded-xl border p-3 shadow-xs backdrop-blur-sm'>
      <IconBadge tone={props.signal.tone} size='sm'>
        <Icon />
      </IconBadge>
      <div className='min-w-0'>
        <div className='text-muted-foreground truncate text-xs font-medium'>
          {props.signal.label}
        </div>
        {props.signal.loading ? (
          <Skeleton className='mt-1 h-5 w-16' />
        ) : (
          <div
            className='truncate font-mono text-sm font-semibold tabular-nums'
            title={props.signal.value}
          >
            {props.signal.value}
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardHero(props: {
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
    <section className='bg-card relative overflow-hidden rounded-3xl border shadow-sm'>
      <div
        className='pointer-events-none absolute -top-24 right-[-5rem] size-72 rounded-full bg-[color-mix(in_oklch,var(--overview-accent-1)_14%,transparent)] blur-3xl'
        aria-hidden='true'
      />
      <div
        className='pointer-events-none absolute -bottom-32 left-[30%] size-80 rounded-full bg-[color-mix(in_oklch,var(--overview-accent-3)_10%,transparent)] blur-3xl'
        aria-hidden='true'
      />
      <div
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_oklch,var(--card)_96%,transparent)_0%,transparent_55%,color-mix(in_oklch,var(--overview-accent-2)_7%,transparent)_100%)]'
        aria-hidden='true'
      />

      <div className='relative flex flex-col gap-6 p-5 sm:p-6'>
        <div className='flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='flex max-w-2xl flex-col gap-3'>
            <Badge
              variant='outline'
              className='bg-background/65 w-fit backdrop-blur-sm'
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  props.online ? 'bg-success' : 'bg-muted-foreground/45',
                  props.online && 'motion-safe:animate-pulse'
                )}
                aria-hidden='true'
              />
              {statusLabel}
            </Badge>
            <div className='flex flex-col gap-1.5'>
              <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
                {t('Live Platform Data')}
              </h2>
              <p className='text-muted-foreground max-w-xl text-sm leading-relaxed sm:text-base'>
                {t(
                  'A focused home for keys, balance, routing, and service health.'
                )}
              </p>
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
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
              render={<Link to='/usage-logs' />}
            >
              <FileText data-icon='inline-start' />
              {t('Usage Logs')}
            </Button>
          </div>
        </div>

        <div className='grid gap-2 sm:grid-cols-3'>
          {props.signals.map((signal) => (
            <OverviewSignalCard key={signal.label} signal={signal} />
          ))}
        </div>
      </div>
    </section>
  )
}

function NextActionCard(props: { action: NextAction }) {
  const { t } = useTranslation()
  const Icon = props.action.icon

  return (
    <section className='bg-card flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center'>
      <div className='flex min-w-0 items-center gap-3'>
        <IconBadge tone='info'>
          <Icon />
        </IconBadge>
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            {t('Get started')}
          </div>
          <div className='truncate text-sm font-semibold'>
            {props.action.title}
          </div>
          <p className='text-muted-foreground line-clamp-1 text-xs'>
            {props.action.description}
          </p>
        </div>
      </div>
      <Button
        variant='outline'
        size='sm'
        className='shrink-0'
        render={<Link to={props.action.to} />}
      >
        {t('Open')}
        <ArrowRight data-icon='inline-end' />
      </Button>
    </section>
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
      tone: 'info',
      loading: apiKeysQuery.isLoading,
    },
    {
      label: t('Available Models'),
      value:
        modelsQuery.data === null || modelsQuery.data === undefined
          ? t('No data')
          : formatNumber(modelsQuery.data.length),
      icon: CircleGauge,
      tone: 'chart-4',
      loading: modelsQuery.isLoading,
    },
    {
      label: t('Endpoint'),
      value: apiInfoItems[0]?.route || t('Current domain'),
      icon: RadioTower,
      tone: 'success',
      loading: apiInfoLoading,
    },
  ]

  let nextAction: NextAction | null = null
  if (apiKeysQuery.data && user) {
    if (!preferredKey) {
      nextAction = {
        title: t('Create API Key'),
        description: t('Create a key for your app or service'),
        to: '/keys',
        icon: KeyRound,
      }
    } else if (remainQuota <= 0 && usedQuota <= 0) {
      nextAction = {
        title: t('Add credits'),
        description: t('Keep enough balance before production traffic'),
        to: '/wallet',
        icon: CreditCard,
      }
    } else if (requestCount <= 0) {
      nextAction = {
        title: t('Send a request'),
        description: t('Verify routing with Playground or your client'),
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
    <div className='flex flex-col gap-4'>
      <CardStaggerContainer>
        <CardStaggerItem>
          <DashboardHero
            signals={signals}
            online={Boolean(status)}
            statusLoading={statusLoading}
          />
        </CardStaggerItem>
      </CardStaggerContainer>

      {nextAction && (
        <CardStaggerContainer>
          <CardStaggerItem>
            <NextActionCard action={nextAction} />
          </CardStaggerItem>
        </CardStaggerContainer>
      )}

      <SummaryCards />

      {visiblePanels.length > 0 && (
        <CardStaggerContainer
          className={cn(
            'grid grid-cols-1 gap-4',
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
