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
import {
  CreditCard,
  RadioTower,
  ShieldCheck,
  TerminalSquare,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { YecaiMetric, YecaiPanel } from '@/components/yecai'
import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getUserModels } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'

import {
  useApiInfo,
  useDashboardContentVisibility,
} from '../../hooks/use-status-data'
import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'
import { EasyOverviewDashboard } from './easy-overview-dashboard'
import { FAQPanel } from './faq-panel'
import { PerformanceHealthPanel } from './performance-health-panel'
import { SummaryCards } from './summary-cards'
import { UptimePanel } from './uptime-panel'

interface HeroSignal {
  label: string
  value: string
  icon: LucideIcon
  tone: 'leaf' | 'model' | 'money' | 'signal'
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? keys[0] ?? null
}

function DeveloperOverviewDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { items: apiInfoItems } = useApiInfo()
  const {
    apiInfo: showApiInfoPanel,
    announcements: showAnnouncementsPanel,
    faq: showFAQPanel,
    uptimeKuma: showUptimePanel,
  } = useDashboardContentVisibility()
  const remainQuota = Number(user?.quota ?? 0)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 10 })
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = await getUserModels()
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const preferredKey = useMemo(
    () => getPreferredKey(apiKeysQuery.data ?? []),
    [apiKeysQuery.data]
  )

  const heroSignals = useMemo<HeroSignal[]>(
    () => [
      {
        label: t('Route active'),
        value: apiInfoItems.length > 0 ? t('Online') : t('Current domain'),
        icon: RadioTower,
        tone: 'signal',
      },
      {
        label: t('Auth configured'),
        value: preferredKey ? t('Secured') : t('Needs API key'),
        icon: ShieldCheck,
        tone: 'leaf',
      },
      {
        label: t('Model selected'),
        value:
          modelsQuery.data?.[0] ??
          (modelsQuery.isLoading ? t('Loading') : t('No models available')),
        icon: Timer,
        tone: 'model',
      },
    ],
    [
      apiInfoItems.length,
      modelsQuery.data,
      modelsQuery.isLoading,
      preferredKey,
      t,
    ]
  )

  const showLeftContentPanels =
    isAdmin || showApiInfoPanel || showAnnouncementsPanel || showFAQPanel
  const showContentPanels = showLeftContentPanels || showUptimePanel

  return (
    <div className='dopa-developer-workbench flex flex-col gap-4'>
      <YecaiPanel
        as='section'
        tone='model'
        layer='hero'
        className='dopa-dev-command-deck dopa-cut-corner dopa-signal-scan'
      >
        <header className='dopa-dev-command-deck__header'>
          <div>
            <span className='dopa-section-kicker'>
              <TerminalSquare className='size-3.5' aria-hidden='true' />
              {t('Developer mode')}
            </span>
            <p className='text-muted-foreground mt-2 max-w-2xl text-xs leading-relaxed'>
              {t(
                'A focused home for keys, balance, routing, and service health.'
              )}
            </p>
          </div>
        </header>

        <div className='dopa-dev-signal-grid'>
          {heroSignals.map((signal) => {
            const Icon = signal.icon

            return (
              <YecaiMetric
                key={signal.label}
                icon={Icon}
                label={signal.label}
                value={signal.value}
                tone={signal.tone}
              />
            )
          })}
          <YecaiMetric
            icon={CreditCard}
            label={t('Credit remaining')}
            value={formatQuota(remainQuota)}
            tone='money'
          />
        </div>
      </YecaiPanel>

      <SummaryCards />

      {showContentPanels && (
        <CardStaggerContainer
          className={cn(
            'grid grid-cols-1 gap-4',
            showLeftContentPanels &&
              showUptimePanel &&
              'xl:grid-cols-[minmax(0,1fr)_22rem]'
          )}
        >
          {showLeftContentPanels && (
            <div
              className={cn(
                'grid min-w-0 grid-cols-1 gap-4',
                (showApiInfoPanel || showAnnouncementsPanel || showFAQPanel) &&
                  'lg:grid-cols-2'
              )}
            >
              {isAdmin && (
                <CardStaggerItem className='lg:col-span-2'>
                  <PerformanceHealthPanel />
                </CardStaggerItem>
              )}
              {showApiInfoPanel && (
                <CardStaggerItem>
                  <ApiInfoPanel />
                </CardStaggerItem>
              )}
              {showAnnouncementsPanel && (
                <CardStaggerItem>
                  <AnnouncementsPanel />
                </CardStaggerItem>
              )}
              {showFAQPanel && (
                <CardStaggerItem>
                  <FAQPanel />
                </CardStaggerItem>
              )}
            </div>
          )}
          {showUptimePanel && (
            <CardStaggerItem>
              <UptimePanel />
            </CardStaggerItem>
          )}
        </CardStaggerContainer>
      )}
    </div>
  )
}

export function OverviewDashboard() {
  const mode = useConsoleModeStore((state) => state.mode)

  return mode === 'easy' ? (
    <EasyOverviewDashboard />
  ) : (
    <DeveloperOverviewDashboard />
  )
}
