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
import { useEffect, useState } from 'react'
import { Gift, Loader2, Zap } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { requestPromoTopup, isApiSuccess } from './api'

// Visual urgency timer: 10 days from the moment the user FIRST sees the dialog. The anchor
// (end timestamp) is persisted in localStorage so a refresh or reopen doesn't reset it.
const COUNTDOWN_DURATION_MS = 10 * 24 * 60 * 60 * 1000
const COUNTDOWN_STORAGE_KEY = 'onboarding_promo_deadline'

// Returns the promo end timestamp (ms), creating+persisting it on first call.
function getPromoDeadline(): number {
  try {
    const stored = localStorage.getItem(COUNTDOWN_STORAGE_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
    const deadline = Date.now() + COUNTDOWN_DURATION_MS
    localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(deadline))
    return deadline
  } catch {
    // localStorage unavailable (private mode / SSR): fall back to a non-persisted window.
    return Date.now() + COUNTDOWN_DURATION_MS
  }
}

// Promo recharge tiers. amount = USD charged. off/usage are OPTIONAL marketing
// labels; only attach a specific discount/multiplier number when it is actually
// backed by operation_setting (AmountDiscount/AmountBonus) for that amount —
// otherwise the badge would promise a discount the backend won't deliver. The
// $10 entry tier intentionally carries no numeric claim (low-friction entry).
interface PromoTier {
  amount: number
  off?: string // e.g. "40% OFF" — omit if not config-backed
  usage?: string // e.g. "3X" — omit if not config-backed
  highlight?: boolean
}
const TIERS: PromoTier[] = [
  { amount: 10 },
  { amount: 20, off: '40% OFF', usage: '3X' },
  { amount: 200, off: '50% OFF', usage: '40X', highlight: true },
]

function breakdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/**
 * Onboarding promo dialog. Floats over the console with a translucent, blurred backdrop.
 * Presents recharge tiers; clicking one starts a real Stripe payment that also binds
 * the card (save_card) for later postpaid auto-charge. Discount figures shown
 * are marketing copy; payment pricing is enforced on the backend.
 */
export function Onboarding() {
  const { t } = useTranslation()
  const open = useOnboardingStore((s) => s.open)
  const closeOnboarding = useOnboardingStore((s) => s.closeOnboarding)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_DURATION_MS)

  useEffect(() => {
    if (!open) return
    // Card-bind funnel step 1: the promo/bind dialog actually opened.
    trackAdsFunnelEvent('flatkey_cardbind_dialog_open')
    const deadline = getPromoDeadline()
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [open])

  const { days, hours, minutes, seconds } = breakdown(remainingMs)
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
          🎟 {t('Congrats — you’ve unlocked a new-user exclusive offer')}
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
            i18nKey='Top up & get <hl>up to 50% OFF</hl>'
            components={{ hl: <span className='text-[#FF2D78]' /> }}
          />
        </h2>
        <p className='text-muted-foreground text-center text-sm'>
          {t(
            'Across Claude / GPT / Gemini and more. Limited-time only — prices revert after it ends.'
          )}
        </p>

        {/* Tier cards */}
        <div className='flex flex-col gap-2.5'>
          {TIERS.map((tier) => (
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
                  {t('Best value')}
                </span>
              )}
              <div className='flex flex-col'>
                <span className='text-lg font-extrabold'>
                  {t('Top up ${{amount}}', {
                    amount: tier.amount,
                  })}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {tier.usage
                    ? t('{{usage}} more usage than the official plan', {
                        usage: tier.usage,
                      })
                    : t('Lowest entry to get started')}
                </span>
              </div>
              <div className='flex flex-col items-end gap-1'>
                {tier.off && (
                  <span className='text-sm font-extrabold text-[#FF2D78]'>
                    {tier.off}
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

        {/* Countdown */}
        <p className='text-muted-foreground text-center text-xs'>
          {t('Offer ends in')}{' '}
          <span className='text-foreground font-bold tabular-nums'>
            {t('{{days}}d {{hours}}h {{minutes}}m {{seconds}}s', {
              days,
              hours,
              minutes,
              seconds,
            })}
          </span>
        </p>

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
