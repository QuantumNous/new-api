import { BadgePercent, ArrowRightLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCnyAmount } from '../lib'
import type { TopupInfo } from '../types'

interface AffiliateRewardsCardProps {
  loading?: boolean
  topupInfo?: TopupInfo | null
  priceRatio?: number
}

function getDiscountTiers(topupInfo?: TopupInfo | null, priceRatio = 1) {
  return Object.entries(topupInfo?.discount ?? {})
    .map(([amount, discount]) => {
      const numericAmount = Number(amount)
      const numericDiscount = Number(discount)
      const originalPrice = numericAmount * priceRatio
      const savedAmount = originalPrice * (1 - numericDiscount)

      return {
        amount: numericAmount,
        discount: numericDiscount,
        savedAmount,
      }
    })
    .filter(
      (tier) =>
        Number.isFinite(tier.amount) &&
        tier.amount > 0 &&
        Number.isFinite(tier.discount) &&
        tier.discount > 0 &&
        tier.discount < 1 &&
        Number.isFinite(tier.savedAmount) &&
        tier.savedAmount > 0
    )
    .sort((first, second) => first.amount - second.amount)
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const priceRatio = props.priceRatio ?? 1

  if (props.loading) {
    return (
      <Card className='overflow-hidden'>
        <CardHeader className='border-b'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-6 pt-6'>
          <Skeleton className='h-20 w-full rounded-lg' />
          <Skeleton className='h-32 w-full rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const discountTiers = getDiscountTiers(props.topupInfo, priceRatio)

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b'>
        <div className='flex items-center gap-3'>
          <div className='bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
            <ArrowRightLeft className='h-4 w-4' />
          </div>
          <div className='min-w-0'>
            <CardTitle className='text-xl tracking-tight'>
              {t('Pricing Information')}
            </CardTitle>
            <CardDescription>
              {t('Recharge rate and discount tiers')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6 pt-6'>
        <div className='rounded-lg border p-4'>
          <div className='mb-2 flex items-center gap-2'>
            <ArrowRightLeft className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Recharge Rate')}
            </span>
          </div>
          <div className='text-2xl font-semibold'>
            {formatCnyAmount(priceRatio)} = $1
          </div>
        </div>

        <div className='space-y-3'>
          <div className='flex items-center gap-2'>
            <BadgePercent className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Recharge Discounts')}
            </span>
          </div>
          <div className='space-y-2'>
            {discountTiers.length > 0 ? (
              discountTiers.map((tier) => (
                <div
                  key={tier.amount}
                  className='bg-muted/30 flex items-center justify-between rounded-lg px-4 py-3'
                >
                  <span className='font-medium'>${tier.amount}</span>
                  <span className='text-sm font-medium text-green-600'>
                    {t('Discount')} {formatCnyAmount(tier.savedAmount)}
                  </span>
                </div>
              ))
            ) : (
              <div className='text-muted-foreground bg-muted/30 rounded-lg px-4 py-3 text-sm'>
                {t('No recharge discounts configured')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
