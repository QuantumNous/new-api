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

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { SettingsSwitchField } from '../components/settings-form-layout'

export interface NowPaymentsSettingsValues {
  NowPaymentsEnabled: boolean
  NowPaymentsApiKey: string
  NowPaymentsIPNSecret: string
  NowPaymentsPriceCurrency: string
  NowPaymentsMinTopUp: number
  NowPaymentsFixedRate: boolean
  NowPaymentsFeePaidByUser: boolean
}

interface Props {
  values: NowPaymentsSettingsValues
  onValueChange: <K extends keyof NowPaymentsSettingsValues>(
    key: K,
    value: NowPaymentsSettingsValues[K]
  ) => void
}

export function NowPaymentsSettingsSection({ values, onValueChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 pt-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('NOWPayments (Crypto)')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Customers pick their cryptocurrency on the NOWPayments hosted checkout page.'
          )}
        </p>
      </div>
      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Create an API key and an IPN secret in the NOWPayments dashboard, then set the IPN callback to /api/nowpayments/webhook on your API domain. Saved credentials are never shown again; leave a field empty to keep the saved value.'
          )}
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SettingsSwitchField
          checked={values.NowPaymentsEnabled}
          onCheckedChange={(v) => onValueChange('NowPaymentsEnabled', v)}
          label={t('Enable NOWPayments')}
          className='py-0'
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label>{t('API Key')}</Label>
          <Input
            type='password'
            autoComplete='off'
            value={values.NowPaymentsApiKey}
            onChange={(event) =>
              onValueChange('NowPaymentsApiKey', event.target.value)
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('IPN Secret Key')}</Label>
          <Input
            type='password'
            autoComplete='off'
            value={values.NowPaymentsIPNSecret}
            onChange={(event) =>
              onValueChange('NowPaymentsIPNSecret', event.target.value)
            }
          />
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label>{t('Pricing currency')}</Label>
          <Input
            value={values.NowPaymentsPriceCurrency}
            onChange={(event) =>
              onValueChange('NowPaymentsPriceCurrency', event.target.value)
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up amount')}</Label>
          <Input
            type='number'
            min={1}
            value={values.NowPaymentsMinTopUp}
            onChange={(event) =>
              onValueChange('NowPaymentsMinTopUp', Number(event.target.value))
            }
          />
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SettingsSwitchField
          checked={values.NowPaymentsFixedRate}
          onCheckedChange={(v) => onValueChange('NowPaymentsFixedRate', v)}
          label={t('Fixed exchange rate')}
          className='py-0'
        />
        <SettingsSwitchField
          checked={values.NowPaymentsFeePaidByUser}
          onCheckedChange={(v) => onValueChange('NowPaymentsFeePaidByUser', v)}
          label={t('Customer pays payment fees')}
          className='py-0'
        />
      </div>
    </div>
  )
}
