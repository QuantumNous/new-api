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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mascotQuickstart } from '@/assets/mascots'

interface QuickStartStep {
  index: number
  titleKey: string
  descKey: string
  to: '/keys' | '/wallet' | '/playground'
}

const STEPS: QuickStartStep[] = [
  {
    index: 1,
    titleKey: 'Register an account',
    descKey: 'Sign up and finish identity verification',
    to: '/keys',
  },
  {
    index: 2,
    titleKey: 'Get API Key',
    descKey: 'Create an API key in Keys management',
    to: '/keys',
  },
  {
    index: 3,
    titleKey: 'Start calling',
    descKey: 'Use your key to invoke the API right away',
    to: '/playground',
  },
]

/**
 * Three-step onboarding timeline with the quick-start chibi mascot
 * tucked into the bottom-right corner.
 */
export function QuickStartTimeline() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)

  // Mark step 1 as completed once the user is logged in (we are inside auth layout).
  const completed: Record<number, boolean> = {
    1: Boolean(user?.id),
    2: false, // Cannot reliably know without fetching keys; left to UI defaults.
    3: Boolean(user?.role && user.role >= ROLE.USER),
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-baseline justify-between gap-3'>
        <div className='flex items-baseline gap-2'>
          <CardTitle className='text-base sm:text-lg'>
            {t('Quick Start')}
          </CardTitle>
          <span className='text-xs text-muted-foreground'>
            {t('3 steps, just a few minutes')}
          </span>
        </div>
      </CardHeader>
      <CardContent className='relative'>
        <ol className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          {STEPS.map((step) => (
            <li
              key={step.index}
              className={cn(
                'relative rounded-xl border bg-background/60 p-3 transition',
                completed[step.index] &&
                  'border-success/30 bg-[color-mix(in_oklch,var(--success)_5%,transparent)]'
              )}
            >
              <div className='flex items-start gap-2.5'>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    'bg-[var(--accent-blue)] text-white'
                  )}
                >
                  {step.index}
                </span>
                <div className='min-w-0'>
                  <div className='text-sm font-medium text-foreground'>
                    {t(step.titleKey)}
                  </div>
                  <div className='mt-0.5 text-xs text-muted-foreground'>
                    {t(step.descKey)}
                  </div>
                  <Link
                    to={step.to}
                    className='mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-blue)] hover:underline'
                  >
                    {t('Go')}
                    <ArrowRight className='size-3' aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <img
          src={mascotQuickstart}
          alt=''
          aria-hidden
          className='pointer-events-none absolute right-2 bottom-0 hidden h-24 w-24 object-contain select-none lg:block'
          draggable={false}
        />
      </CardContent>
    </Card>
  )
}
