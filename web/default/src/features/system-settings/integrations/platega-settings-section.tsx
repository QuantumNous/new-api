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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'
import { PlategaOrdersAdminPanel } from './platega-orders-admin-panel'

export interface PlategaSettingsValues {
  PlategaEnabled: boolean
  PlategaMinTopUp: number
  PlategaUSDRate: number
  PlategaReturnURL: string
  PlategaFailedURL: string
  PlategaFeePercent: number
}

interface Props {
  defaultValues: PlategaSettingsValues
}

export function PlategaSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const form = useForm<PlategaSettingsValues>({
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const handleSave = async () => {
    const values = form.getValues()
    if (values.PlategaEnabled && Number(values.PlategaUSDRate) <= 0) {
      toast.error(t('USD to RUB rate must be greater than 0'))
      return
    }
    if (values.PlategaEnabled && Number(values.PlategaMinTopUp) < 1) {
      toast.error(t('Minimum top-up must be at least 1'))
      return
    }

    setLoading(true)
    try {
      const entries: Array<{ key: keyof PlategaSettingsValues; value: string }> = [
        { key: 'PlategaEnabled', value: String(!!values.PlategaEnabled) },
        { key: 'PlategaMinTopUp', value: String(values.PlategaMinTopUp ?? 1) },
        { key: 'PlategaUSDRate', value: String(values.PlategaUSDRate ?? 90) },
        {
          key: 'PlategaReturnURL',
          value: removeTrailingSlash(values.PlategaReturnURL ?? ''),
        },
        {
          key: 'PlategaFailedURL',
          value: removeTrailingSlash(values.PlategaFailedURL ?? ''),
        },
        { key: 'PlategaFeePercent', value: String(values.PlategaFeePercent ?? 8.5) },
      ]
      for (const entry of entries) {
        await updateOption.mutateAsync({ key: entry.key, value: entry.value })
      }
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  const enabled = form.watch('PlategaEnabled')

  return (
    <SettingsSection
      title={t('Platega integration (admin)')}
      description={t('Russian SBP QR payment settings. Credentials are read from server environment variables.')}
    >
      <Alert className='mb-4'>
        <AlertDescription>
          {t('Set PLATEGA_MERCHANT_ID and PLATEGA_X_SECRET in the new-api container environment. Callback URL: https://apimaster.ai/api/payment/platega/callback')}
        </AlertDescription>
      </Alert>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='platega-enabled'>{t('Enable Platega top-up')}</Label>
          <Switch
            id='platega-enabled'
            checked={enabled}
            onCheckedChange={(checked) => form.setValue('PlategaEnabled', checked)}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='platega-min-topup'>{t('Minimum top-up (USD quota)')}</Label>
            <Input
              id='platega-min-topup'
              type='number'
              min={1}
              {...form.register('PlategaMinTopUp', { valueAsNumber: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='platega-usd-rate'>{t('USD to RUB rate')}</Label>
            <Input
              id='platega-usd-rate'
              type='number'
              step='0.01'
              min={0}
              {...form.register('PlategaUSDRate', { valueAsNumber: true })}
            />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='platega-return-url'>{t('Return URL after payment')}</Label>
            <Input id='platega-return-url' {...form.register('PlategaReturnURL')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='platega-failed-url'>{t('Return URL after failed payment')}</Label>
            <Input id='platega-failed-url' {...form.register('PlategaFailedURL')} />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='platega-fee'>{t('SBP QR fee note (%)')}</Label>
          <Input
            id='platega-fee'
            type='number'
            step='0.1'
            {...form.register('PlategaFeePercent', { valueAsNumber: true })}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Platform absorbs fee by default; adjust recharge math here if users should pay fees.')}
          </p>
        </div>

        <Button type='button' onClick={handleSave} disabled={loading}>
          {loading ? t('Saving...') : t('Save Platega settings')}
        </Button>
      </div>

      <PlategaOrdersAdminPanel />
    </SettingsSection>
  )
}
