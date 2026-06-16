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
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { beginCardBind, isApiSuccess } from './api'

// Visual-only urgency timer (seconds). Resets each time the dialog opens.
const COUNTDOWN_SECONDS = 10 * 60

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Card-binding onboarding dialog. Floats over the console with a translucent,
 * blurred backdrop (so the dashboard shows through). Visibility is driven by the
 * onboarding store — opened on first login or via the card-bind banner.
 *
 * Promo presentation only: the discount figures are marketing copy; actual
 * pricing/discount is configured on the backend, not enforced here.
 */
export function Onboarding() {
  const { t } = useTranslation()
  const open = useOnboardingStore((s) => s.open)
  const config = useSystemConfig()
  const BONUS_LABEL = `$${config.stripeNewUserBonusAmount ?? 10}`
  const closeOnboarding = useOnboardingStore((s) => s.closeOnboarding)
  const [submitting, setSubmitting] = useState(false)
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS)

  // Visual countdown: restart when the dialog opens, tick down to zero and hold.
  useEffect(() => {
    if (!open) return
    setRemaining(COUNTDOWN_SECONDS)
    const timer = setInterval(() => {
      setRemaining((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  const startBind = async () => {
    setSubmitting(true)
    try {
      const res = await beginCardBind()
      if (isApiSuccess(res) && res.data?.bind_link) {
        window.location.assign(res.data.bind_link)
        return
      }
      toast.error(res.message || t('Failed to start card binding'))
    } catch {
      toast.error(t('Failed to start card binding'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOnboarding()
      }}
    >
      <DialogContent
        className='gap-5 sm:max-w-md'
        showCloseButton={!submitting}
      >
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

        {/* Headline with neon highlights */}
        <h2 className='text-center text-2xl font-extrabold leading-tight tracking-tight'>
          <Trans
            i18nKey='Bind a card for <hl>up to 40% OFF</hl> on all models<br/>＋ <hl>{{amount}} free credit</hl>'
            values={{ amount: BONUS_LABEL }}
            components={{ hl: <span className='text-[#FF2D78]' />, br: <br /> }}
          />
        </h2>

        <p className='text-muted-foreground text-center text-sm'>
          {t(
            'Across Claude / GPT / Gemini and more. Limited-time only — prices revert after it ends.'
          )}
        </p>

        {/* Promo ticket */}
        <div className='bg-muted/60 rounded-xl border p-4'>
          <p className='flex items-center justify-center gap-1.5 text-center text-sm font-medium'>
            <span className='text-[#C6F24E]'>✓</span>
            {t('New-user discount auto-activated (no code needed)')}
          </p>
          <div className='border-border my-3 border-t border-dashed' />
          <div className='flex items-stretch'>
            <div className='flex flex-1 flex-col items-center justify-center'>
              <span className='text-2xl font-extrabold text-[#FF2D78]'>
                {t('Up to 40% OFF')}
              </span>
              <span className='text-muted-foreground mt-0.5 text-xs'>
                {t('All models, limited time')}
              </span>
            </div>
            <div className='bg-border w-px' aria-hidden='true' />
            <div className='flex flex-1 flex-col items-center justify-center'>
              <span className='font-mono text-2xl font-extrabold tabular-nums'>
                {pad(minutes)} : {pad(seconds)}
              </span>
              <span className='text-muted-foreground mt-0.5 text-xs'>
                {t('minutes')} &nbsp; {t('seconds')}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className='flex flex-col gap-2'>
          <Button
            size='lg'
            className='w-full'
            onClick={startBind}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className='size-4 animate-spin' aria-hidden='true' />
            ) : (
              <Zap className='size-4' aria-hidden='true' />
            )}
            {t('Bind card & claim now')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='w-full'
            onClick={closeOnboarding}
            disabled={submitting}
          >
            {t('Skip for now')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
