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
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { modelPricingConfig, pricingCurrencyConfig } from '../../model-pricing-config'

interface ModelPricingProps {
  className?: string
}

function formatPrice(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-'
  }
  const { symbol } = pricingCurrencyConfig
  return `${symbol}${value.toFixed(value >= 1 ? 2 : 4).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')}`
}

export function ModelPricing(_props: ModelPricingProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-20 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-xl'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-[0.2em] uppercase'>
            {t('Model Pricing')}
          </p>
          <h2 className='text-2xl leading-tight font-semibold tracking-tight md:text-3xl'>
            {t('Mainstream model prices at a glance')}
          </h2>
          <p className='text-muted-foreground mt-3 text-sm'>
            {t('Official price, current price, and discount are dynamically calculated from backend pricing configuration.')}
          </p>
        </AnimateInView>

        <div className='border-border/70 bg-card/80 overflow-hidden rounded-2xl border shadow-[0_24px_60px_-44px_color-mix(in_oklch,var(--foreground)_28%,transparent)] backdrop-blur-sm'>
          <div className='bg-muted/55 grid grid-cols-4 px-5 py-3 text-xs font-semibold tracking-wide uppercase md:px-6'>
            <span>{t('Model')}</span>
            <span className='text-right'>{t('Official Input')}</span>
            <span className='text-right'>{t('Official Output')}</span>
            <span className='text-right'>{t('Cache Hit')}</span>
          </div>
          <div>
            {modelPricingConfig.map((item) => (
              <div
                key={item.name}
                className='border-border/45 grid grid-cols-4 items-center border-t px-5 py-3 text-sm md:px-6'
              >
                <span className='font-medium'>{item.name}</span>
                <span className='text-right font-mono text-muted-foreground'>
                  {formatPrice(item.officialInput)}
                </span>
                <span className='text-right font-mono text-muted-foreground'>
                  {formatPrice(item.officialOutput)}
                </span>
                <span className='text-right font-mono text-emerald-700 dark:text-emerald-300'>
                  {item.cacheHit || '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
