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

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'

import type { PricingInputs } from '../lib/calculation'

type CalculatorInputsProps = {
  value: PricingInputs
  onChange: (nextValue: PricingInputs) => void
}

type NumericFieldProps = {
  id: string
  label: string
  value: number
  suffix: string
  min: number
  max?: number
  step: number
  onChange: (value: number) => void
}

function NumericField(props: NumericFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={props.id}
          type='number'
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(event) =>
            props.onChange(event.currentTarget.valueAsNumber)
          }
        />
        <InputGroupAddon align='inline-end'>
          <InputGroupText>{props.suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

export function CalculatorInputs(props: CalculatorInputsProps) {
  const { t } = useTranslation()

  const update = (field: keyof PricingInputs, value: number) => {
    props.onChange({
      ...props.value,
      [field]: Number.isFinite(value) ? value : 0,
    })
  }

  return (
    <Card className='h-fit'>
      <CardHeader className='border-b'>
        <CardTitle>{t('Calculation inputs')}</CardTitle>
        <CardDescription>
          {t('Use costs and usage from the same account reset period.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='space-y-2'>
          <div className='text-muted-foreground text-xs font-medium'>
            {t('Account cost presets')}
          </div>
          <div className='flex flex-wrap gap-2'>
            {[6, 15, 25].map((cost) => (
              <Button
                key={cost}
                type='button'
                size='sm'
                variant={
                  props.value.accountCost === cost ? 'default' : 'outline'
                }
                onClick={() => update('accountCost', cost)}
              >
                ¥{cost}
              </Button>
            ))}
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <NumericField
            id='account-cost'
            label={t('Cost per account')}
            value={props.value.accountCost}
            suffix={t('CNY')}
            min={0}
            step={0.01}
            onChange={(value) => update('accountCost', value)}
          />
          <NumericField
            id='account-period-days'
            label={t('Account quota period')}
            value={props.value.accountPeriodDays}
            suffix={t('days')}
            min={1}
            step={1}
            onChange={(value) => update('accountPeriodDays', value)}
          />
          <NumericField
            id='observed-standard-usage'
            label={t('Observed standard usage (A)')}
            value={props.value.observedStandardUsage}
            suffix='A'
            min={0}
            step={0.0001}
            onChange={(value) => update('observedStandardUsage', value)}
          />
          <NumericField
            id='used-percent'
            label={t('Quota consumed')}
            value={props.value.usedPercent}
            suffix='%'
            min={0.01}
            max={100}
            step={0.01}
            onChange={(value) => update('usedPercent', value)}
          />
          <NumericField
            id='billing-period-days'
            label={t('Accounting period')}
            value={props.value.billingPeriodDays}
            suffix={t('days')}
            min={1}
            step={1}
            onChange={(value) => update('billingPeriodDays', value)}
          />
          <NumericField
            id='manual-ratio'
            label={t('Manual group ratio')}
            value={props.value.manualRatio}
            suffix='x'
            min={0}
            step={0.0001}
            onChange={(value) => update('manualRatio', value)}
          />
          <Field className='sm:col-span-2'>
            <FieldLabel htmlFor='target-margin'>
              {t('Target gross margin')}
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id='target-margin'
                type='number'
                min={0}
                max={99.9}
                step={1}
                value={props.value.targetMarginPercent}
                onChange={(event) =>
                  update(
                    'targetMarginPercent',
                    event.currentTarget.valueAsNumber
                  )
                }
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              {t('U equals A multiplied by the group ratio.')}
            </FieldDescription>
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}
