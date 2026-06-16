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
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { requestPromoTopup, isApiSuccess } from './api'
import { depositBonusUsd } from '../wallet/lib/deposit-bonus'

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

// Two promo recharge tiers. amount = USD charged; the bonus is the single source of truth in
// deposit-bonus.ts (depositBonusUsd), mirrored from the backend depositBonusTiers. The
// usage/off labels are marketing copy (actual discount lives in group ratios).
interface PromoTier {
  amount: number
  off: string // e.g. "40% OFF"
  usage: string // e.g. "3X"
  highlight?: boolean
}
const TIERS: PromoTier[] = [
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
 * Presents two recharge tiers; clicking one starts a real Stripe payment that also binds
 * the card (save_card) for later postpaid auto-charge. The bonus/discount figures shown are
 * marketing copy — the actual deposit bonus and pricing are enforced on the backend.
 */
export function Onboarding() {
  const { t } = useTranslation()
  const open = useOnboardingStore((s) => s.open)
  const closeOnboarding = useOnboardingStore((s) => s.closeOnboarding)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_DURATION_MS)

  useEffect(() => {
    if (!open) return
    const deadline = getPromoDeadline()
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [open])

  const { days, hours, minutes, seconds } = breakdown(remainingMs)
  const submitting = pendingAmount !== null

  const startTopup = async (amount: number) => {
    setPendingAmount(amount)
    try {
      const res = await requestPromoTopup(amount)
      if (isApiSuccess(res) && res.data?.pay_link) {
        window.location.assign(res.data.pay_link)
        return
      }
      toast.error(res.message || t('Failed to start payment'))
    } catch {
      toast.error(t('Failed to start payment'))
    } finally {
      setPendingAmount(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOnboarding()
      }}
    >
      <DialogContent className='gap-5 sm:max-w-md' showCloseButton={!submitting}>
        {/* Eyebrow */}
        <p className='text-muted-foreground text-center text-xs font-medium'>
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
        <h2 className='text-center text-2xl font-extrabold leading-tight tracking-tight'>
          <Trans
            i18nKey='Top up & get <hl>up to 50% OFF</hl><br/>＋ bonus credit on every plan'
            components={{ hl: <span className='text-[#FF2D78]' />, br: <br /> }}
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
                  {t('Top up ${{amount}} → get ${{total}}', {
                    amount: tier.amount,
                    total: tier.amount + depositBonusUsd(tier.amount),
                  })}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {t('{{usage}} more usage than the official plan', {
                    usage: tier.usage,
                  })}
                </span>
              </div>
              <div className='flex flex-col items-end gap-1'>
                <span className='text-sm font-extrabold text-[#FF2D78]'>
                  {tier.off}
                </span>
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
          <span className='font-bold tabular-nums text-foreground'>
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
          onClick={closeOnboarding}
          disabled={submitting}
        >
          {t('Skip for now')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
