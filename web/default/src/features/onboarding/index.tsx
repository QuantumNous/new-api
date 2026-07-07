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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift, Loader2, Zap } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getTopupInfo } from '@/features/wallet/api'
import { requestPromoTopup, isApiSuccess } from './api'

// Recharge tiers. amount = USD charged, bonus = USD credited on top of the
// amount. Derived from /api/user/topup/info (operation_setting AmountBonus,
// already filtered to what this user's group can actually receive) so the
// dialog never promises credit the payment callback won't deliver.
interface PromoTier {
  amount: number
  bonus: number
  highlight?: boolean
}

// Shown only when the bonus config is unavailable — plain amounts, no
// bonus promises.
const FALLBACK_AMOUNTS = [10, 20, 200]

/**
 * Onboarding promo dialog. Floats over the console with a translucent, blurred backdrop.
 * Presents recharge tiers; clicking one starts a real Stripe payment that also binds
 * the card (save_card) for later postpaid auto-charge. Bonus figures shown must
 * match the backend AmountBonus config; crediting is enforced on the backend.
 */
export function Onboarding() {
  const { t } = useTranslation()
  const open = useOnboardingStore((s) => s.open)
  const closeOnboarding = useOnboardingStore((s) => s.closeOnboarding)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)

  const topupInfoQuery = useQuery({
    queryKey: ['onboarding', 'topup-info'],
    queryFn: getTopupInfo,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const tiers = useMemo<PromoTier[]>(() => {
    const info = topupInfoQuery.data?.data
    const remaining = info?.bonus_remaining ?? {}
    // Stripe checkout packages only accept amounts present in
    // payment_setting.amount_options — a bonus tier outside that set would
    // render a button whose payment request the backend rejects.
    const allowedAmounts = new Set(
      (info?.amount_options ?? []).map((amount) => Number(amount))
    )
    const fromBonus = Object.entries(info?.bonus ?? {})
      .map(([amount, bonus]) => ({
        amount: Number(amount),
        bonus: Number(bonus),
      }))
      // remaining === 0 means this user exhausted the tier's lifetime bonus
      // count; undefined means unlimited.
      .filter(
        (tier) =>
          tier.amount > 0 &&
          tier.bonus > 0 &&
          (allowedAmounts.size === 0 || allowedAmounts.has(tier.amount)) &&
          remaining[tier.amount] !== 0
      )
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 3)
    if (fromBonus.length > 0) {
      return fromBonus.map((tier, index) =>
        index === 0 ? { ...tier, highlight: true } : tier
      )
    }
    const amounts =
      info?.amount_options && info.amount_options.length > 0
        ? info.amount_options
        : FALLBACK_AMOUNTS
    return amounts
      .map((amount) => Number(amount))
      .filter((amount) => amount > 0)
      .slice(0, 3)
      .map((amount, index) => ({
        amount,
        bonus: 0,
        highlight: index === 0,
      }))
  }, [topupInfoQuery.data])

  useEffect(() => {
    if (!open) return
    // Card-bind funnel step 1: the promo/bind dialog actually opened.
    trackAdsFunnelEvent('flatkey_cardbind_dialog_open')
  }, [open])

  const submitting = pendingAmount !== null

  const startTopup = async (amount: number) => {
    // Funnel step 2: user picked a tier (this is the only way to bind a card — binding
    // currently REQUIRES a real top-up payment, there is no free card-save path).
    trackAdsFunnelEvent('flatkey_cardbind_tier_click', { amount })
    setPendingAmount(amount)
    try {
      const res = await requestPromoTopup(amount)
      if (isApiSuccess(res) && res.data?.pay_link) {
        // Funnel step 3: redirecting to Stripe Checkout. Drop-off after this = abandoned on Stripe.
        trackAdsFunnelEvent('flatkey_cardbind_stripe_redirect', { amount })
        window.location.assign(res.data.pay_link)
        return
      }
      trackAdsFunnelEvent('flatkey_cardbind_start_error', {
        amount,
        reason: res.message || 'no_pay_link',
      })
      toast.error(res.message || t('Failed to start payment'))
    } catch {
      trackAdsFunnelEvent('flatkey_cardbind_start_error', {
        amount,
        reason: 'exception',
      })
      toast.error(t('Failed to start payment'))
    } finally {
      setPendingAmount(null)
    }
  }

  // Funnel: user dismissed the dialog without binding (the dominant drop-off to watch).
  const handleSkip = () => {
    trackAdsFunnelEvent('flatkey_cardbind_skip')
    closeOnboarding()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleSkip()
      }}
    >
      <DialogContent
        className='gap-5 sm:max-w-md'
        showCloseButton={!submitting}
      >
        {/* Eyebrow — symmetric horizontal padding keeps the centered text clear of the
            absolutely-positioned close (X) button, which otherwise overlaps long
            translations (PT/ES/JP) on the first line. */}
        <p className='text-muted-foreground px-8 text-center text-xs font-medium'>
          🎟 {t('Every top-up earns bonus credit')}
        </p>

        {/* Glowing gift icon */}
        <div
          className='mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#C6F24E]'
          style={{ boxShadow: '0 0 32px 4px rgba(198,242,78,0.55)' }}
        >
          <Gift className='size-8 text-black' aria-hidden='true' />
        </div>

        {/* Headline */}
        <h2 className='text-center text-2xl leading-tight font-extrabold tracking-tight'>
          <Trans
            i18nKey='Top up & get <hl>bonus credit</hl> — every time'
            components={{ hl: <span className='text-[#FF2D78]' /> }}
          />
        </h2>
        <p className='text-muted-foreground text-center text-sm'>
          {t(
            'Models are priced at 60–90% of the official list. Top up $200 and get $100 free — both discounts stack, as low as 50% of the official price.'
          )}
        </p>

        {/* Tier cards */}
        <div className='flex flex-col gap-2.5'>
          {topupInfoQuery.isLoading &&
            FALLBACK_AMOUNTS.map((amount) => (
              <div
                key={amount}
                className='bg-muted/50 h-[74px] animate-pulse rounded-xl border'
                aria-hidden='true'
              />
            ))}
          {!topupInfoQuery.isLoading && tiers.map((tier) => (
            <button
              key={tier.amount}
              type='button'
              disabled={submitting}
              onClick={() => startTopup(tier.amount)}
              className={
                'relative flex items-center justify-between rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ' +
                (tier.highlight
                  ? 'border-[#FF2D78] bg-[#FF2D78]/5 hover:bg-[#FF2D78]/10'
                  : 'bg-muted/50 hover:bg-muted')
              }
            >
              {tier.highlight && (
                <span className='absolute -top-2 right-3 rounded-full bg-[#FF2D78] px-2 py-0.5 text-[10px] font-bold text-white'>
                  {t('Most Popular')}
                </span>
              )}
              <div className='flex flex-col'>
                <span className='text-lg font-extrabold'>
                  {t('Top up ${{amount}}', {
                    amount: tier.amount,
                  })}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {t('You get ${{total}} in credit', {
                    total: tier.amount + tier.bonus,
                  })}
                </span>
              </div>
              <div className='flex flex-col items-end gap-1'>
                {tier.bonus > 0 && (
                  <span className='text-sm font-extrabold text-[#FF2D78]'>
                    {t('+${{bonus}} free', { bonus: tier.bonus })}
                  </span>
                )}
                {submitting && pendingAmount === tier.amount ? (
                  <Loader2 className='size-4 animate-spin' aria-hidden='true' />
                ) : (
                  <Zap className='size-4 text-[#FF2D78]' aria-hidden='true' />
                )}
              </div>
            </button>
          ))}
        </div>

        <Button
          variant='ghost'
          size='sm'
          className='w-full'
          onClick={handleSkip}
          disabled={submitting}
        >
          {t('Skip for now')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
