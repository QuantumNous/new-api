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
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'
import { FAQPanel } from './faq-panel'
import { PerformanceHealthPanel } from './performance-health-panel'
import { SummaryCards } from './summary-cards'
import { UptimePanel } from './uptime-panel'

/**
 * Preserves access to the legacy overview panels (API info, announcements,
 * FAQ, uptime, performance health, summary cards) inside a collapsible
 * section so the new visual design stays focused while admin-relevant
 * tooling remains reachable.
 *
 * Defaults to collapsed; the user's preference is persisted in localStorage.
 */
const LEGACY_PREF_KEY = 'dashboard_overview_legacy_status_expanded'

export function LegacyStatusSection() {
  const { t } = useTranslation()
  const userRole = useAuthStore((s) => s.auth.user?.role)
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)

  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(LEGACY_PREF_KEY) === 'expanded'
  })

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LEGACY_PREF_KEY, next ? 'expanded' : 'collapsed')
    }
  }

  return (
    <Card>
      <button
        type='button'
        onClick={toggle}
        className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left'
        aria-expanded={expanded}
      >
        <div>
          <div className='text-sm font-semibold'>{t('System status')}</div>
          <div className='text-xs text-muted-foreground'>
            {t('Detailed metrics, uptime, announcements and FAQs')}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {expanded && (
        <CardContent className='flex flex-col gap-4 pt-0'>
          <SummaryCards />
          <CardStaggerContainer className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]'>
            <div className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2'>
              {isAdmin && (
                <CardStaggerItem className='lg:col-span-2'>
                  <PerformanceHealthPanel />
                </CardStaggerItem>
              )}
              <CardStaggerItem>
                <ApiInfoPanel />
              </CardStaggerItem>
              <CardStaggerItem>
                <AnnouncementsPanel />
              </CardStaggerItem>
              <CardStaggerItem>
                <FAQPanel />
              </CardStaggerItem>
            </div>
            <CardStaggerItem>
              <UptimePanel />
            </CardStaggerItem>
          </CardStaggerContainer>
        </CardContent>
      )}
    </Card>
  )
}
