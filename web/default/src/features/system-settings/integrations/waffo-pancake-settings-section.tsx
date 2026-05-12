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
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

export interface WaffoPancakeSettingsValues {
  WaffoPancakeEnabled: boolean
  WaffoPancakeSandbox: boolean
  WaffoPancakeMerchantID: string
  WaffoPancakePrivateKey: string
  WaffoPancakeWebhookPublicKey: string
  WaffoPancakeWebhookTestKey: string
  WaffoPancakeStoreID: string
  WaffoPancakeProductID: string
  WaffoPancakeReturnURL: string
  WaffoPancakeCurrency: string
  WaffoPancakeUnitPrice: number
  WaffoPancakeMinTopUp: number
}

interface Props {
  defaultValues: WaffoPancakeSettingsValues
}

export function WaffoPancakeSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const form = useForm<WaffoPancakeSettingsValues>({
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const handleSave = async () => {
    const values = form.getValues()
    const enabled = !!values.WaffoPancakeEnabled
    const sandbox = !!values.WaffoPancakeSandbox

    if (enabled && !values.WaffoPancakeMerchantID.trim()) {
      toast.error(t('Merchant ID is required'))
      return
    }

    if (enabled && !values.WaffoPancakeStoreID.trim()) {
      toast.error(t('Store ID is required'))
      return
    }

    if (enabled && !values.WaffoPancakeProductID.trim()) {
      toast.error(t('Product ID is required'))
      return
    }

    const requiredWebhookKey = sandbox
      ? values.WaffoPancakeWebhookTestKey
      : values.WaffoPancakeWebhookPublicKey
    if (enabled && !String(requiredWebhookKey || '').trim()) {
      toast.error(
        sandbox
          ? t('Webhook public key (sandbox) is required')
          : t('Webhook public key (production) is required')
      )
      return
    }

    if (enabled && Number(values.WaffoPancakeUnitPrice) <= 0) {
      toast.error(t('Unit price must be greater than 0'))
      return
    }

    if (enabled && Number(values.WaffoPancakeMinTopUp) < 1) {
      toast.error(t('Minimum top-up amount must be at least 1'))
      return
    }

    setLoading(true)
    try {
      const options: { key: string; value: string }[] = [
        { key: 'WaffoPancakeEnabled', value: enabled ? 'true' : 'false' },
        { key: 'WaffoPancakeSandbox', value: sandbox ? 'true' : 'false' },
        {
          key: 'WaffoPancakeMerchantID',
          value: values.WaffoPancakeMerchantID || '',
        },
        {
          key: 'WaffoPancakeStoreID',
          value: values.WaffoPancakeStoreID || '',
        },
        {
          key: 'WaffoPancakeProductID',
          value: values.WaffoPancakeProductID || '',
        },
        {
          key: 'WaffoPancakeReturnURL',
          value: removeTrailingSlash(values.WaffoPancakeReturnURL || ''),
        },
        {
          key: 'WaffoPancakeCurrency',
          value: values.WaffoPancakeCurrency || 'USD',
        },
        {
          key: 'WaffoPancakeUnitPrice',
          value: String(values.WaffoPancakeUnitPrice ?? 1),
        },
        {
          key: 'WaffoPancakeMinTopUp',
          value: String(values.WaffoPancakeMinTopUp ?? 1),
        },
      ]

      if ((values.WaffoPancakePrivateKey || '').trim()) {
        options.push({
          key: 'WaffoPancakePrivateKey',
          value: values.WaffoPancakePrivateKey,
        })
      }

      if ((values.WaffoPancakeWebhookPublicKey || '').trim()) {
        options.push({
          key: 'WaffoPancakeWebhookPublicKey',
          value: values.WaffoPancakeWebhookPublicKey,
        })
      }

      if ((values.WaffoPancakeWebhookTestKey || '').trim()) {
        options.push({
          key: 'WaffoPancakeWebhookTestKey',
          value: values.WaffoPancakeWebhookTestKey,
        })
      }

      for (const option of options) {
        await updateOption.mutateAsync(option)
      }
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      title={t('Waffo Pancake Payment Gateway')}
      description={t(
        'Configure Waffo Pancake hosted checkout integration for USD-priced top-ups'
      )}
    >
      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Obtain the merchant, store, product and signing keys from your Waffo dashboard. Webhook URL: <ServerAddress>/api/waffo-pancake/webhook'
          )}
        </AlertDescription>
      </Alert>

      <div className='grid grid-cols-3 gap-4'>
        <div className='flex items-center gap-2'>
          <Switch
            checked={form.watch('WaffoPancakeEnabled')}
            onCheckedChange={(value) =>
              form.setValue('WaffoPancakeEnabled', value)
            }
          />
          <Label>{t('Enable Waffo Pancake')}</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            checked={form.watch('WaffoPancakeSandbox')}
            onCheckedChange={(value) =>
              form.setValue('WaffoPancakeSandbox', value)
            }
          />
          <Label>{t('Sandbox mode')}</Label>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Currency')}</Label>
          <Input placeholder='USD' {...form.register('WaffoPancakeCurrency')} />
        </div>
      </div>

      <div className='grid grid-cols-3 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Merchant ID')}</Label>
          <Input
            placeholder='MER_xxx'
            {...form.register('WaffoPancakeMerchantID')}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Store ID')}</Label>
          <Input
            placeholder='STO_xxx'
            {...form.register('WaffoPancakeStoreID')}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Product ID')}</Label>
          <Input
            placeholder='PROD_xxx'
            {...form.register('WaffoPancakeProductID')}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('API Private Key')}</Label>
          <Textarea
            rows={3}
            placeholder={t('Leave blank to keep the existing key')}
            {...form.register('WaffoPancakePrivateKey')}
            className='font-mono text-xs'
          />
          <p className='text-muted-foreground text-xs'>
            {t('Stored value is not echoed back for security')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Payment return URL')}</Label>
          <Input
            placeholder='https://example.com/console/topup'
            {...form.register('WaffoPancakeReturnURL')}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Defaults to the wallet page when empty')}
          </p>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Webhook public key (production)')}</Label>
          <Textarea
            rows={3}
            placeholder={t('Leave blank to keep the existing key')}
            {...form.register('WaffoPancakeWebhookPublicKey')}
            className='font-mono text-xs'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Webhook public key (sandbox)')}</Label>
          <Textarea
            rows={3}
            placeholder={t('Leave blank to keep the existing key')}
            {...form.register('WaffoPancakeWebhookTestKey')}
            className='font-mono text-xs'
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Unit price (local currency / USD)')}</Label>
          <Input
            type='number'
            step={0.01}
            min={0}
            {...form.register('WaffoPancakeUnitPrice', { valueAsNumber: true })}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up (USD)')}</Label>
          <Input
            type='number'
            min={1}
            {...form.register('WaffoPancakeMinTopUp', { valueAsNumber: true })}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? t('Saving...') : t('Save Waffo Pancake settings')}
      </Button>
    </SettingsSection>
  )
}
