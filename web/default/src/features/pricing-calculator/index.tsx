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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'

import { CalculatorInputs } from './components/calculator-inputs'
import { CalculatorResults } from './components/calculator-results'
import { calculatePricing, type PricingInputs } from './lib/calculation'

const DEFAULT_INPUTS: PricingInputs = {
  accountCost: 6,
  accountPeriodDays: 7,
  observedStandardUsage: 23.04,
  usedPercent: 15,
  billingPeriodDays: 30,
  manualRatio: 0.35,
  targetMarginPercent: 50,
}

export function PricingCalculator() {
  const { t } = useTranslation()
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const result = useMemo(() => calculatePricing(inputs), [inputs])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='inline-flex min-w-0 items-center gap-2'>
          <span className='truncate'>{t('Pricing Ratio Calculator')}</span>
          <Badge variant='outline' className='shrink-0'>
            {t('Admin only')}
          </Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto grid max-w-6xl items-start gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(480px,1.2fr)]'>
          <CalculatorInputs value={inputs} onChange={setInputs} />
          <CalculatorResults result={result} manualRatio={inputs.manualRatio} />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
