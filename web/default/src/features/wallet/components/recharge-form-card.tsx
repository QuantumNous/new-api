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
import { ArrowRight, CheckCircle2, Loader2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { FlatkeyTallyEmbed } from '@/features/pricing/components/flatkey-tally-embed'
import {
  STRIPE_CHECKOUT_CURRENCY_OPTIONS,
  type StripeCheckoutCurrency,
} from '../lib/stripe-currency'
import type { PresetAmount, TopupInfo } from '../types'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  onStripeTopUp: (preset: PresetAmount) => void
  paymentLoadingAmount?: number | null
  loading?: boolean
  checkoutCurrency: StripeCheckoutCurrency
  onCheckoutCurrencyChange: (currency: StripeCheckoutCurrency) => void
}

// local currencies unlock local payment methods at Stripe checkout
// (Pix needs BRL, UPI needs INR); symbols are display-only hints.
const CURRENCY_SYMBOLS: Record<StripeCheckoutCurrency, string> = {
  USD: '$',
  INR: '₹',
  BRL: 'R$',
  JPY: '¥',
}

type CheckoutPlanCopy = {
  action: 'checkout'
  amount: number
  caption: string
  description: string
  features: string[]
  name: string
  badge?: string
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
  featured?: never
}

const ENTRY_PACKAGE_FEATURES = [
  'Prepaid balance, no surprise bill',
  'One API key for everything',
  'Zero vendor lock-in',
  'Usage analytics and cost controls',
]

const WEBSITE_CHECKOUT_PLAN_COPY_BY_AMOUNT: Record<number, CheckoutPlanCopy> = {
  10: {
    action: 'checkout',
    amount: 10,
    name: 'Top up {{price}}',
    caption: 'Lowest entry to get started',
    description:
      'No contract required. Add balance, create a key, copy the base_url, and test your first request.',
    features: ENTRY_PACKAGE_FEATURES,
  },
  20: {
    action: 'checkout',
    amount: 20,
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
    featured: true,
  },
  200: {
    action: 'checkout',
    amount: 200,
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
  },
}

const CONTACT_PLAN_CARD: ContactPlanCopy = {
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
}

function formatTopUpAmount(amount: number): string {
  return `$${formatNumber(amount)}`
}

function getCheckoutPlanCopy(
  preset: PresetAmount,
  index: number
): CheckoutPlanCopy {
  const knownPlanCopy = WEBSITE_CHECKOUT_PLAN_COPY_BY_AMOUNT[preset.value]
  if (knownPlanCopy) {
    return knownPlanCopy
  }

  return {
    action: 'checkout',
    amount: preset.value,
    name: 'Top up {{price}}',
    caption:
      index === 0
        ? 'Lowest entry to get started'
        : 'Prepaid balance, no surprise bill',
    description:
      'No contract required. Add balance, create a key, copy the base_url, and test your first request.',
    features: ENTRY_PACKAGE_FEATURES,
  }
}

function getConfiguredPresetAmounts(
  presetAmounts: PresetAmount[]
): PresetAmount[] {
  const seen = new Set<number>()
  return presetAmounts.filter((preset) => {
    if (!Number.isFinite(preset.value) || preset.value <= 0) {
      return false
    }
    if (seen.has(preset.value)) {
      return false
    }
    seen.add(preset.value)
    return true
  })
}

export function WalletEnterpriseContactContent() {
  const { t } = useTranslation()

  return (
    <>
      <DialogHeader className='pr-8'>
        <p className='text-muted-foreground text-xs font-medium tracking-normal uppercase'>
          {t('Enterprise teams')}
        </p>
        <h2 className='text-base leading-none font-medium'>
          {t('Enterprise sales inquiry form')}
        </h2>
        <p className='text-muted-foreground text-sm'>
          {t(
            'For higher monthly usage, invoicing, team procurement, or custom routing discounts.'
          )}
        </p>
      </DialogHeader>
      <FlatkeyTallyEmbed className='border-border/70 bg-background mt-2 rounded-lg border' />
    </>
  )
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
  const checkoutPresetAmounts = getConfiguredPresetAmounts(props.presetAmounts)
  const planCards: Array<
    | { planCopy: CheckoutPlanCopy; preset: PresetAmount }
    | { planCopy: ContactPlanCopy; preset: null }
  > = [
    ...checkoutPresetAmounts.map((preset, index) => ({
      planCopy: getCheckoutPlanCopy(preset, index),
      preset,
    })),
    { planCopy: CONTACT_PLAN_CARD, preset: null },
  ]

  return (
    <TitledCard
      title={t('Top-up Packages')}
      description={t('Choose a prepaid USD package and checkout with Stripe')}
      icon={<WalletCards className='h-4 w-4' />}
      contentClassName='space-y-4 sm:space-y-6'
    >
      {stripeEnabled && checkoutPresetAmounts.length > 0 ? (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-xs'>
            {t('Checkout currency')}
          </span>
          {STRIPE_CHECKOUT_CURRENCY_OPTIONS.map((currency) => (
            <Button
              key={currency}
              size='sm'
              variant={
                currency === props.checkoutCurrency ? 'default' : 'outline'
              }
              onClick={() => props.onCheckoutCurrencyChange(currency)}
            >
              {CURRENCY_SYMBOLS[currency]} {currency}
            </Button>
          ))}
        </div>
      ) : null}
      {stripeEnabled && checkoutPresetAmounts.length > 0 ? (
        <div className='grid gap-3 lg:grid-cols-4'>
          {planCards.map((planCard) => {
            const planCopy = planCard.planCopy
            const preset = planCard.preset
            const selected =
              preset != null && props.selectedPreset === preset.value
            const loading =
              preset != null && props.paymentLoadingAmount === preset.value
            const price =
              planCard.preset != null
                ? formatTopUpAmount(planCard.preset.value)
                : t(planCard.planCopy.price)

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
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          variant='outline'
                          className='mt-auto w-full'
                        />
                      }
                    >
                      {t('Contact Us')}
                      <ArrowRight className='h-4 w-4' />
                    </DialogTrigger>
                    <DialogContent className='max-h-[94dvh] overflow-y-auto sm:max-w-3xl lg:max-w-4xl'>
                      <WalletEnterpriseContactContent />
                    </DialogContent>
                  </Dialog>
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
