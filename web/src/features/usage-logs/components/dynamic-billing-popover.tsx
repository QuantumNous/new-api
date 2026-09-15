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
import { CircleQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import type { DynamicBillingDetails } from '../lib/request-details'

const moneyOptions = { digitsLarge: 6, digitsSmall: 6, abbreviate: false }

type DynamicBillingPopoverProps = {
  details: DynamicBillingDetails
  charged: string
}

export function DynamicBillingPopover(props: DynamicBillingPopoverProps) {
  const { t } = useTranslation()
  const multiplier = Number(props.details.requestMultiplier.toFixed(6))
  const multiplierSuffix = multiplier === 1 ? '' : ` × ${multiplier}x`

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={120}
        render={
          <Button
            type='button'
            variant='outline'
            size='icon-xs'
            className='ci-requestBillingHelp'
            aria-label={t('Billing Details')}
          >
            <CircleQuestionMark aria-hidden='true' />
          </Button>
        }
      />
      <HoverCardContent
        side='bottom'
        align='start'
        sideOffset={8}
        className='ci-requestBillingPopover w-96 max-w-[calc(100vw-1.5rem)]'
        role='tooltip'
        aria-label={t('Billing Details')}
      >
        <div className='ci-requestBillingPopoverHeader'>
          <strong>{t('Billing Details')}</strong>
          <span>
            {t('Matched Tier')}: {props.details.tierLabel}
          </span>
        </div>
        <dl className='ci-requestBillingLines'>
          {props.details.lineItems.map((item) => (
            <div key={item.key}>
              <dt>
                <strong>{t(item.labelKey)}</strong>
                <span>
                  {item.quantity.toLocaleString()} ×{' '}
                  {formatBillingCurrencyFromUSD(item.unitPrice, moneyOptions)}
                  /M{multiplierSuffix}
                </span>
              </dt>
              <dd>
                {formatBillingCurrencyFromUSD(
                  item.costBeforeGroup,
                  moneyOptions
                )}
              </dd>
            </div>
          ))}
        </dl>
        {multiplier !== 1 ? (
          <div className='ci-requestBillingMultiplier'>
            <span>{t('Multiplier')}</span>
            <strong>{multiplier}x</strong>
          </div>
        ) : null}
        <div className='ci-requestBillingTotals'>
          <div>
            <span>{t('Before-discount estimate')}</span>
            <strong>
              {formatBillingCurrencyFromUSD(
                props.details.costBeforeGroup,
                moneyOptions
              )}
            </strong>
          </div>
          <div>
            <span>{t('Charge')}</span>
            <strong>{props.charged}</strong>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
