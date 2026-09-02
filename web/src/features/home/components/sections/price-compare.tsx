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
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { formatCnyAmount, type SavingsModel } from '../../lib/pricing-savings'

interface PriceCompareProps {
  models: SavingsModel[]
}

interface PricePairProps {
  input: number
  output: number
  emphasized?: boolean
  struck?: boolean
}

function PricePair(props: PricePairProps) {
  const { t } = useTranslation()
  const formatOptions = {
    digitsLarge: 2,
    digitsSmall: 4,
    abbreviate: false,
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 font-mono text-xs tabular-nums sm:text-sm',
        props.emphasized && 'text-primary font-bold',
        props.struck && 'text-muted-foreground decoration-2 line-through'
      )}
    >
      <span>
        <span className='font-sans font-normal no-underline'>{t('Input')}</span>{' '}
        {formatCnyAmount(props.input, {
          maximumFractionDigits:
            props.input >= 1
              ? formatOptions.digitsLarge
              : formatOptions.digitsSmall,
        })}
      </span>
      <span>
        <span className='font-sans font-normal no-underline'>
          {t('Output')}
        </span>{' '}
        {formatCnyAmount(props.output, {
          maximumFractionDigits:
            props.output >= 1
              ? formatOptions.digitsLarge
              : formatOptions.digitsSmall,
        })}
      </span>
    </div>
  )
}

function SavingsBadge(props: { percent: number }) {
  const { t } = useTranslation()
  if (props.percent <= 0) return null

  return (
    <span className='bg-success/12 text-success inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold'>
      {t('Save {{percent}}%', { percent: props.percent })}
    </span>
  )
}

export function PriceCompare(props: PriceCompareProps) {
  const { t } = useTranslation()

  return (
    <article className='dopa-paper dopa-cut-corner overflow-hidden'>
      <div className='flex items-end justify-between gap-4 px-5 pt-6 pb-3 sm:px-7'>
        <div>
          <h3 className='text-lg font-extrabold'>
            {t('Latest model price check')}
          </h3>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('CNY / 1 million tokens')}
          </p>
        </div>
        <span className='bg-success/12 text-success rounded-full px-3 py-1 text-xs font-bold'>
          {t('Updates automatically')}
        </span>
      </div>

      <div data-testid='desktop-price-table' className='hidden md:block'>
        <table className='w-full border-collapse text-left'>
          <thead>
            <tr className='text-muted-foreground border-border border-b text-xs'>
              <th className='px-7 py-3 font-semibold'>{t('Model')}</th>
              <th className='px-5 py-3 font-semibold'>{t('Our price')}</th>
              <th className='px-7 py-3 font-semibold'>{t('Official API')}</th>
            </tr>
          </thead>
          <tbody>
            {props.models.map((model) => (
              <tr
                key={model.modelName}
                className='border-border/80 border-b last:border-b-0'
              >
                <td className='px-7 py-4'>
                  <div className='max-w-52 truncate text-sm font-bold'>
                    {model.modelName}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {model.vendorName}
                  </div>
                </td>
                <td className='px-5 py-4'>
                  <div className='flex flex-col gap-2'>
                    <PricePair
                      emphasized
                      input={model.siteInputPrice}
                      output={model.siteOutputPrice}
                    />
                    <SavingsBadge percent={model.savingsPercent} />
                  </div>
                </td>
                <td className='px-7 py-4'>
                  <PricePair
                    struck={model.savingsPercent > 0}
                    input={model.officialInputPrice}
                    output={model.officialOutputPrice}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        data-testid='mobile-price-cards'
        className='divide-border divide-y md:hidden'
      >
        {props.models.map((model) => (
          <div key={model.modelName} className='px-5 py-5'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-bold'>
                  {model.modelName}
                </div>
                <div className='text-muted-foreground mt-0.5 text-xs'>
                  {model.vendorName}
                </div>
              </div>
              <SavingsBadge percent={model.savingsPercent} />
            </div>
            <div className='mt-4 grid grid-cols-2 gap-4'>
              <div>
                <div className='text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase'>
                  {t('Our price')}
                </div>
                <PricePair
                  emphasized
                  input={model.siteInputPrice}
                  output={model.siteOutputPrice}
                />
              </div>
              <div>
                <div className='text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase'>
                  {t('Official API')}
                </div>
                <PricePair
                  struck={model.savingsPercent > 0}
                  input={model.officialInputPrice}
                  output={model.officialOutputPrice}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs sm:px-7'>
        <span className='text-muted-foreground'>
          {t('Prices update from the live model catalog.')}
        </span>
        <Link
          to='/pricing'
          className='text-primary inline-flex items-center gap-1 font-bold hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2'
        >
          {t('View model marketplace')}
          <ArrowUpRight className='size-3.5' aria-hidden='true' />
        </Link>
      </div>
    </article>
  )
}
