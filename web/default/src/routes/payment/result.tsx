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
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Home,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const paymentResultSearchSchema = z.object({
  kind: z.enum(['topup', 'subscription']).catch('topup'),
  status: z.enum(['success', 'pending', 'fail']).catch('pending'),
})

type PaymentKind = z.infer<typeof paymentResultSearchSchema>['kind']
type PaymentStatus = z.infer<typeof paymentResultSearchSchema>['status']

export const Route = createFileRoute('/payment/result')({
  component: RouteComponent,
  validateSearch: paymentResultSearchSchema,
})

function RouteComponent() {
  const { kind, status } = Route.useSearch()
  return <PaymentResult kind={kind} status={status} />
}

function PaymentResult(props: { kind: PaymentKind; status: PaymentStatus }) {
  const { t } = useTranslation()
  const detailHref = '/wallet?show_history=true'
  const detailText = t('View wallet')
  const kindText =
    props.kind === 'subscription'
      ? t('Subscription payment')
      : t('Wallet top-up')
  const statusConfig = getStatusConfig(props.status)
  const statusCopy = {
    success: {
      title: t('Payment confirmed'),
      label: t('Payment has been confirmed'),
      description: t(
        'We have received confirmation from the payment provider. Your balance or subscription may take a few seconds to sync.'
      ),
    },
    pending: {
      title: t('Payment is being confirmed'),
      label: t('Payment confirmation is in progress'),
      description: t(
        'Your payment has been submitted. We are waiting for the payment provider to finish confirmation.'
      ),
    },
    fail: {
      title: t('Payment not confirmed'),
      label: t('We could not confirm this payment'),
      description: t(
        'The payment result could not be verified. Please return to your account later to check the final status.'
      ),
    },
  }[props.status]
  const Icon = statusConfig.icon

  return (
    <main className='bg-background text-foreground min-h-svh'>
      <div className='mx-auto flex min-h-svh w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8'>
        <section className='bg-card grid w-full overflow-hidden rounded-lg border shadow-sm md:grid-cols-[0.9fr_1.1fr]'>
          <div className='bg-muted/40 border-b p-6 md:border-r md:border-b-0 md:p-8'>
            <div className='flex h-full flex-col justify-between gap-10'>
              <div>
                <p className='text-muted-foreground text-sm font-medium'>
                  {t('Payment result')}
                </p>
                <h1 className='mt-3 text-3xl font-semibold tracking-normal sm:text-4xl'>
                  {statusCopy.title}
                </h1>
              </div>
              <div className='text-muted-foreground space-y-2 text-sm'>
                <p>{kindText}</p>
                <p>{t('No sensitive order details are shown on this page.')}</p>
              </div>
            </div>
          </div>

          <div className='p-6 md:p-8'>
            <div className='flex flex-col gap-6'>
              <div className='flex items-start gap-4'>
                <div
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-lg border',
                    statusConfig.iconClass
                  )}
                >
                  <Icon className='size-6' />
                </div>
                <div className='min-w-0'>
                  <p className='text-lg font-medium'>{statusCopy.label}</p>
                  <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-6'>
                    {statusCopy.description}
                  </p>
                </div>
              </div>

              <div className='border-border bg-muted/30 rounded-lg border p-4 text-sm leading-6'>
                {t(
                  'If you paid from a mobile wallet, you can return to the original browser to continue using your account.'
                )}
              </div>

              <div className='flex flex-col gap-3 sm:flex-row'>
                <Button className='h-10' render={<a href={detailHref} />}>
                  <WalletCards data-icon='inline-start' className='size-4' />
                  {detailText}
                </Button>
                <Button
                  variant='outline'
                  className='h-10'
                  render={<a href='/' />}
                >
                  <Home data-icon='inline-start' className='size-4' />
                  {t('Back to Home')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function getStatusConfig(status: PaymentStatus) {
  switch (status) {
    case 'success':
      return {
        icon: CheckCircle2,
        iconClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
      }
    case 'fail':
      return {
        icon: AlertTriangle,
        iconClass: 'border-destructive/30 bg-destructive/10 text-destructive',
      }
    default:
      return {
        icon: Clock3,
        iconClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
      }
  }
}
