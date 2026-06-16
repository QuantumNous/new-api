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
import { Sparkles, ChevronRight } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useSystemConfig } from '@/hooks/use-system-config'
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

  if (!isCardBindEligible(user, config.enableStripeCardBind)) return null

  return (
    // Outer padding mirrors SectionPageLayout's content gutters (px-3 sm:px-4) so the banner's
    // left/right edges line up with the page (e.g. the overview cards) below it. pt matches the
    // page title's top padding; mb-[15px] keeps a 15px gap to the content beneath.
    <div className='shrink-0 px-3 pt-3 sm:px-4'>
      <button
        type='button'
        onClick={openOnboarding}
        className='group bg-primary/5 hover:bg-primary/10 border-primary/15 relative mb-[15px] flex h-[50px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border px-4 text-sm font-medium text-foreground transition-colors'
      >
        {/* Limited-time pill */}
        <span className='bg-primary text-primary-foreground flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold'>
          <Sparkles className='size-3' aria-hidden='true' />
          {t('Limited time')}
        </span>
        <span>
          <Trans
            i18nKey='First top-up <hl>50% bonus</hl> · same models at half the official price'
            components={{ hl: <span className='text-primary font-extrabold' /> }}
          />
        </span>
        <ChevronRight
          className='text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5'
          aria-hidden='true'
        />
      </button>
    </div>
  )
}
