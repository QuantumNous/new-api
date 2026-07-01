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
import { CheckCircle2, Loader2, Mail, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import type { PresetAmount, TopupInfo } from '../types'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  onStripeTopUp: (preset: PresetAmount) => void
  paymentLoadingAmount?: number | null
  loading?: boolean
}

type CheckoutPlanCopy = {
  action: 'checkout'
  amount: number
  caption: string
  description: string
  features: string[]
  name: string
  price: string
  badge?: string
  discount?: string
  featured?: boolean
}

type ContactPlanCopy = {
  action: 'contact'
  caption: string
  description: string
  features: string[]
  name: string
  price: string
  amount?: never
  badge?: never
  discount?: never
  featured?: never
}

type PlanCopy = CheckoutPlanCopy | ContactPlanCopy

const WEBSITE_PLAN_CARDS: PlanCopy[] = [
  {
    action: 'checkout',
    amount: 10,
    price: '$10',
    name: 'Top up {{price}}',
    caption: 'Lowest entry to get started',
    description:
      'No contract required. Add balance, create a key, copy the base_url, and test your first request.',
    features: [
      'Prepaid balance, no surprise bill',
      'One API key for everything',
      'Zero vendor lock-in',
      'Usage analytics and cost controls',
    ],
  },
  {
    action: 'checkout',
    amount: 20,
    price: '$20',
    name: 'Top up {{price}}',
    caption: '3X more usage than the official plan',
    description:
      'Best first top-up for trying real API workloads with a clear discount.',
    features: [
      'Permanently 20-40% cheaper',
      'Usage analytics and cost controls',
      'Enterprise-grade privacy',
      'One invoice across providers',
    ],
    badge: 'Most Popular',
    discount: '+5 free bonus',
    featured: true,
  },
  {
    action: 'checkout',
    amount: 200,
    price: '$200',
    name: 'Top up {{price}}',
    caption: '40X more usage than the official plan',
    description:
      'Best value for production testing, team workflows, and sustained model traffic.',
    features: [
      'Highest prepaid value',
      'Usage analytics and cost controls',
      'Enterprise-grade privacy',
      'One invoice across providers',
    ],
    discount: '+100 free bonus',
  },
  {
    action: 'contact',
    price: 'Custom',
    name: 'Enterprise',
    caption: 'Custom usage, routing, and invoicing',
    description:
      'For higher monthly usage, invoicing, team procurement, or custom routing discounts.',
    features: [
      'Custom monthly usage',
      'Team procurement support',
      'Custom routing discounts',
      'One invoice across providers',
    ],
  },
]

function formatTopUpAmount(amount: number): string {
  return `$${formatNumber(amount)}`
}

export function RechargeFormCard(props: RechargeFormCardProps) {
  const { t } = useTranslation()
  const stripeEnabled =
    props.topupInfo?.enable_stripe_topup ||
    props.topupInfo?.pay_methods?.some((method) => method.type === 'stripe')

  if (props.loading) {
    return (
      <TitledCard
        title={t('Top-up Packages')}
        description={t('Choose a prepaid USD package and checkout with Stripe')}
        icon={<WalletCards className='h-4 w-4' />}
        contentClassName='space-y-4 sm:space-y-6'
      >
        <div className='grid gap-3 sm:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className='h-56 rounded-lg' />
          ))}
        </div>
      </TitledCard>
    )
  }

  const handleTopUpClick = (preset: PresetAmount): void => {
    props.onSelectPreset(preset)
    props.onStripeTopUp(preset)
  }

  return (
    <TitledCard
      title={t('Top-up Packages')}
      description={t('Choose a prepaid USD package and checkout with Stripe')}
      icon={<WalletCards className='h-4 w-4' />}
      contentClassName='space-y-4 sm:space-y-6'
    >
      {stripeEnabled ? (
        <div className='grid gap-3 lg:grid-cols-4'>
          {WEBSITE_PLAN_CARDS.map((planCopy) => {
            const preset =
              planCopy.action === 'checkout'
                ? props.presetAmounts.find(
                    (candidate) => candidate.value === planCopy.amount
                  ) || { value: planCopy.amount }
                : null
            const selected =
              preset != null && props.selectedPreset === preset.value
            const loading =
              preset != null && props.paymentLoadingAmount === preset.value
            const price = preset
              ? formatTopUpAmount(preset.value)
              : t(planCopy.price)

            return (
              <div
                key={planCopy.amount ?? planCopy.name}
                className={cn(
                  'bg-background relative flex min-h-[440px] flex-col rounded-lg border p-4 transition-colors',
                  selected
                    ? 'border-foreground bg-foreground/[0.03]'
                    : 'border-border',
                  planCopy.featured && 'border-primary/60 shadow-sm'
                )}
              >
                <div className='mb-3 flex min-h-6 items-center gap-2'>
                  {planCopy.badge ? (
                    <span className='bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold'>
                      {t(planCopy.badge)}
                    </span>
                  ) : null}
                  {planCopy.discount ? (
                    <span className='rounded-full border border-[#FF2D78]/30 bg-[#FF2D78]/10 px-2 py-0.5 text-[11px] font-semibold text-[#D80D5D] dark:text-[#FF78A9]'>
                      {t(planCopy.discount)}
                    </span>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold tracking-normal'>
                    {t(planCopy.name, { price })}
                  </h3>
                  <div className='text-3xl font-semibold tracking-normal'>
                    {price}
                  </div>
                  <p className='text-sm font-medium'>{t(planCopy.caption)}</p>
                  <p className='text-muted-foreground text-xs leading-5'>
                    {t(planCopy.description)}
                  </p>
                  {preset?.bonus && preset.bonus > 0 ? (
                    <p className='text-xs font-semibold text-[#FF2D78]'>
                      {t('Get {{bonus}} free', {
                        bonus: formatTopUpAmount(preset.bonus),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className='mt-5 space-y-3'>
                  {planCopy.features.map((feature) => (
                    <p
                      key={feature}
                      className='text-muted-foreground flex gap-2 text-xs leading-5'
                    >
                      <CheckCircle2 className='text-primary mt-0.5 h-4 w-4 shrink-0' />
                      <span>{t(feature)}</span>
                    </p>
                  ))}
                </div>

                {preset ? (
                  <Button
                    className='mt-auto w-full'
                    onClick={() => handleTopUpClick(preset)}
                    disabled={!!props.paymentLoadingAmount}
                  >
                    {loading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : null}
                    {t('Top up for {{amount}}', {
                      amount: `$${formatNumber(preset.value)}`,
                    })}
                  </Button>
                ) : (
                  <a
                    className='border-border bg-background hover:bg-muted mt-auto inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors'
                    href='mailto:support@flatkey.ai'
                  >
                    <Mail className='h-4 w-4' />
                    {t('Contact Us')}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {stripeEnabled
              ? t('No top-up packages available. Please contact administrator.')
              : t(
                  'Stripe top-up is not enabled. Please contact administrator.'
                )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
