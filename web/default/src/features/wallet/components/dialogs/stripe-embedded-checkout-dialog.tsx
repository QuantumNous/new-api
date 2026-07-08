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
import { useEffect, useRef, useState } from 'react'
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Dialog } from '@/components/dialog'
import type { StripeTopupSummary } from '../../types'

export interface StripeEmbeddedCheckoutSession {
  clientSecret: string
  publishableKey: string
  summary: StripeTopupSummary | null
}

interface StripeEmbeddedCheckoutDialogProps {
  session: StripeEmbeddedCheckoutSession | null
  onOpenChange: (open: boolean) => void
}

/**
 * Renders Stripe Checkout inside the console (embedded ui_mode) so buyers never leave
 * our domain. Completion is handled by Stripe: it redirects to the session's return_url.
 * Closing the dialog simply abandons the pending session — the order stays pending and
 * is expired by the checkout.session.expired webhook, same as leaving the hosted page.
 */
export function StripeEmbeddedCheckoutDialog({
  session,
  onOpenChange,
}: StripeEmbeddedCheckoutDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={Boolean(session)}
      onOpenChange={onOpenChange}
      title={t('Complete your top-up')}
      description={t('Payment is processed securely by Stripe.')}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-[480px]'
      contentHeight='auto'
      bodyClassName='p-0'
    >
      {session ? (
        // Keyed by client secret so a new session always starts from a fresh
        // "mounting" state instead of resetting state inside an effect.
        <EmbeddedCheckoutFrame
          key={session.clientSecret}
          session={session}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  )
}

function EmbeddedCheckoutFrame({
  session,
  onOpenChange,
}: {
  session: StripeEmbeddedCheckoutSession
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mounting, setMounting] = useState(true)

  useEffect(() => {
    let cancelled = false
    let checkout: StripeEmbeddedCheckout | null = null

    const mount = async () => {
      try {
        const stripe = await loadStripe(session.publishableKey)
        if (!stripe) {
          throw new Error('stripe.js failed to load')
        }
        const embedded = await stripe.createEmbeddedCheckoutPage({
          clientSecret: session.clientSecret,
        })
        if (cancelled || !containerRef.current) {
          embedded.destroy()
          return
        }
        checkout = embedded
        embedded.mount(containerRef.current)
      } catch (_error) {
        if (!cancelled) {
          toast.error(t('Failed to load the payment form, please try again'))
          onOpenChange(false)
        }
      } finally {
        if (!cancelled) {
          setMounting(false)
        }
      }
    }

    void mount()

    return () => {
      cancelled = true
      checkout?.destroy()
    }
  }, [session, onOpenChange, t])

  const summary = session.summary
  const showBonusBanner = Boolean(summary?.show_amounts && summary.bonus_amount > 0)

  return (
    <div className='min-h-[480px]'>
      {showBonusBanner && summary ? (
        <div className='mx-4 mt-1 mb-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-center text-white'>
          <Gift className='h-4 w-4 shrink-0' />
          <span className='text-sm font-bold sm:text-base'>
            {t('Pay ${{pay}}, get ${{total}} — includes ${{bonus}} bonus', {
              pay: summary.pay_amount,
              total: summary.credit_amount,
              bonus: summary.bonus_amount,
            })}
          </span>
        </div>
      ) : null}
      {mounting && (
        <div className='flex h-[480px] items-center justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}
