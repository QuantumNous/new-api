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
import { useEffect } from 'react'
import { Sparkles, ChevronRight } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useSystemConfig } from '@/hooks/use-system-config'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { isCardBindEligible } from './card-bind-eligibility'

/**
 * A persistent, festive promo banner shown to any signed-in user who has not yet bound a
 * card (e.g. after they skipped the onboarding dialog). Clicking it re-opens that dialog.
 * Renders in the same top slot as the low-balance banner. Disappears once a card is bound
 * or when the card-bind feature is disabled.
 */
export function CardBindBanner() {
  const { t } = useTranslation()
  const config = useSystemConfig()
  const user = useAuthStore((s) => s.auth.user)
  const openOnboarding = useOnboardingStore((s) => s.openOnboarding)

  const eligible = isCardBindEligible(user, config.enableStripeCardBind)
  // Funnel step 0: the card-bind banner was actually shown to an eligible (un-bound) user.
  useEffect(() => {
    if (eligible) trackAdsFunnelEvent('flatkey_cardbind_banner_view')
  }, [eligible])

  if (!eligible) return null

  const handleClick = () => {
    trackAdsFunnelEvent('flatkey_cardbind_banner_click')
    openOnboarding()
  }

  return (
    // Outer padding mirrors SectionPageLayout's content gutters (px-3 sm:px-4) so the banner's
    // left/right edges line up with the page (e.g. the overview cards) below it. pt matches the
    // page title's top padding; mb-[15px] keeps a 15px gap to the content beneath.
    <div className='shrink-0 px-3 pt-3 sm:px-4'>
      <button
        type='button'
        onClick={handleClick}
        className='group relative mb-[15px] flex h-[50px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-fuchsia-500/50 hover:brightness-110'
      >
        {/* Periodic sheen sweep + a brighter one on hover. */}
        <span
          aria-hidden='true'
          className='animate-bonus-shine pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-white/30 blur-md'
        />
        {/* Standing-offer pill — frosted glass on the gradient. */}
        <span className='relative flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold ring-1 ring-white/40 ring-inset backdrop-blur-sm'>
          <Sparkles className='size-3 animate-pulse' aria-hidden='true' />
          {t('Top-up bonus')}
        </span>
        <span className='relative'>
          <Trans
            i18nKey='Every top-up <hl>earns bonus credit</hl> · same models, up to 50% off the official price'
            components={{
              hl: (
                <span className='font-extrabold text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.45)]' />
              ),
            }}
          />
        </span>
        <ChevronRight
          className='relative size-4 shrink-0 transition-transform group-hover:translate-x-1'
          aria-hidden='true'
        />
      </button>
    </div>
  )
}
