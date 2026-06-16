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
import { Gift, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useSystemConfig } from '@/hooks/use-system-config'

/**
 * A persistent banner shown to any signed-in user who has not yet bound a card,
 * inviting them to bind one and claim the bonus. Disappears once a card is bound
 * or when the card-bind feature is disabled.
 */
export function CardBindBanner() {
  const { t } = useTranslation()
  const config = useSystemConfig()
  const user = useAuthStore((s) => s.auth.user)
  const openOnboarding = useOnboardingStore((s) => s.openOnboarding)
  const bonusLabel = `$${config.stripeNewUserBonusAmount ?? 10}`

  if (!config.enableStripeCardBind) return null
  if (!user || user.stripe_card_bound) return null

  return (
    <button
      type='button'
      onClick={openOnboarding}
      className='bg-primary/10 text-primary hover:bg-primary/15 flex w-full items-center justify-center gap-2 px-4 py-2 text-sm transition-colors'
    >
      <Gift className='size-4 shrink-0' aria-hidden='true' />
      <span>
        {t('Bind a credit card to claim {{amount}} in API credit', {
          amount: bonusLabel,
        })}
      </span>
      <ChevronRight className='size-4 shrink-0' aria-hidden='true' />
    </button>
  )
}
