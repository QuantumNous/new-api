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
import { Activity03Icon, RefreshIcon, RouteIcon, ShieldKeyIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface FeatureItem {
  icon: typeof Activity03Icon
  titleKey: string
  descKey: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: ShieldKeyIcon,
    titleKey: 'Unified Authentication',
    descKey: 'Unified API Key management, single auth across every model',
  },
  {
    icon: RefreshIcon,
    titleKey: 'Automatic Retries',
    descKey: 'Smart retries and failover keep requests highly available',
  },
  {
    icon: RouteIcon,
    titleKey: 'Model Routing',
    descKey: 'Route by rules to the best model — balance cost and quality',
  },
  {
    icon: Activity03Icon,
    titleKey: 'Usage Monitoring',
    descKey: 'Realtime usage and spend stats with multi-dimensional charts',
  },
]

/**
 * Four-up feature highlight strip shown on the dashboard overview.
 * Pure-static / marketing — no data dependencies.
 */
export function FeatureCards() {
  const { t } = useTranslation()

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      {FEATURES.map((feature) => (
        <Card key={feature.titleKey}>
          <CardContent className='flex items-start gap-3 px-4'>
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                'bg-[color-mix(in_oklch,var(--accent-blue)_12%,transparent)] text-[var(--accent-blue)]'
              )}
            >
              <HugeiconsIcon icon={feature.icon} className='size-5' />
            </div>
            <div className='min-w-0'>
              <div className='text-sm font-semibold text-foreground'>
                {t(feature.titleKey)}
              </div>
              <div className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>
                {t(feature.descKey)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
