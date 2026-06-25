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

export interface ClinkSettingsValues {
  ClinkEnabled: boolean
  ClinkSandbox: boolean
  ClinkMinTopUp: number
  ClinkCurrency: string
  ClinkSuccessURL: string
  ClinkCancelURL: string
}

interface Props {
  defaultValues: ClinkSettingsValues
}

export function ClinkSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const form = useForm<ClinkSettingsValues>({
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const handleSave = async () => {
    const values = form.getValues()
    if (values.ClinkEnabled && Number(values.ClinkMinTopUp) < 1) {
      toast.error(t('Minimum top-up must be at least 1'))
      return
    }

    setLoading(true)
    try {
      const entries: Array<{ key: keyof ClinkSettingsValues; value: string }> = [
        { key: 'ClinkEnabled', value: String(!!values.ClinkEnabled) },
        { key: 'ClinkSandbox', value: String(!!values.ClinkSandbox) },
        { key: 'ClinkMinTopUp', value: String(values.ClinkMinTopUp ?? 1) },
        { key: 'ClinkCurrency', value: String(values.ClinkCurrency ?? 'USD').trim() || 'USD' },
        {
          key: 'ClinkSuccessURL',
          value: removeTrailingSlash(values.ClinkSuccessURL ?? ''),
        },
        {
          key: 'ClinkCancelURL',
          value: removeTrailingSlash(values.ClinkCancelURL ?? ''),
        },
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

  const enabled = form.watch('ClinkEnabled')

  return (
    <SettingsSection
      title={t('Clink integration (admin)')}
      description={t('Global hosted checkout via Clink. API keys are read from server environment variables.')}
    >
      <Alert className='mb-4'>
        <AlertDescription>
          {t('Set CLINK_SECRET_KEY, CLINK_PUBLISHABLE_KEY, and CLINK_WEBHOOK_SECRET in the new-api container. UAT API: https://uat-api.clinkbill.com. Webhook URL: https://apimaster.ai/api/payment/clink/webhook')}
        </AlertDescription>
      </Alert>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='clink-enabled'>{t('Enable Clink top-up')}</Label>
          <Switch
            id='clink-enabled'
            checked={enabled}
            onCheckedChange={(checked) => form.setValue('ClinkEnabled', checked)}
          />
        </div>

        <div className='flex items-center justify-between'>
          <Label htmlFor='clink-sandbox'>{t('Use Clink sandbox (UAT)')}</Label>
          <Switch
            id='clink-sandbox'
            checked={form.watch('ClinkSandbox')}
            onCheckedChange={(checked) => form.setValue('ClinkSandbox', checked)}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='clink-min-topup'>{t('Minimum top-up (USD quota)')}</Label>
            <Input
              id='clink-min-topup'
              type='number'
              min={1}
              {...form.register('ClinkMinTopUp', { valueAsNumber: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='clink-currency'>{t('Checkout currency')}</Label>
            <Input id='clink-currency' {...form.register('ClinkCurrency')} />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='clink-success-url'>{t('Return URL after payment')}</Label>
            <Input id='clink-success-url' {...form.register('ClinkSuccessURL')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='clink-cancel-url'>{t('Return URL after canceled payment')}</Label>
            <Input id='clink-cancel-url' {...form.register('ClinkCancelURL')} />
          </div>
        </div>

        <Button type='button' onClick={handleSave} disabled={loading}>
          {loading ? t('Saving...') : t('Save Clink settings')}
        </Button>
      </div>
    </SettingsSection>
  )
}
