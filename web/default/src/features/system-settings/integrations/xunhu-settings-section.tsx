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

export interface XunhuSettingsValues {
  XunhuEnabled: boolean
  XunhuGatewayUrl: string
  XunhuWxAppId: string
  XunhuWxAppSecret: string
  XunhuAliAppId: string
  XunhuAliAppSecret: string
  XunhuUnitPrice: number
  XunhuMinTopUp: number
}

interface Props {
  defaultValues: XunhuSettingsValues
}

export function XunhuSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)

  const form = useForm<XunhuSettingsValues>({
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = form.getValues()
      const options: { key: string; value: string }[] = [
        { key: 'XunhuEnabled', value: String(values.XunhuEnabled) },
        {
          key: 'XunhuGatewayUrl',
          value:
            values.XunhuGatewayUrl ||
            'https://api.xunhupay.com/payment/do.html',
        },
        { key: 'XunhuWxAppId', value: values.XunhuWxAppId || '' },
        { key: 'XunhuAliAppId', value: values.XunhuAliAppId || '' },
        { key: 'XunhuUnitPrice', value: String(values.XunhuUnitPrice || 1) },
        { key: 'XunhuMinTopUp', value: String(values.XunhuMinTopUp || 1) },
      ]
      if (values.XunhuWxAppSecret) {
        options.push({
          key: 'XunhuWxAppSecret',
          value: values.XunhuWxAppSecret,
        })
      }
      if (values.XunhuAliAppSecret) {
        options.push({
          key: 'XunhuAliAppSecret',
          value: values.XunhuAliAppSecret,
        })
      }

      for (const opt of options) {
        await updateOption.mutateAsync(opt)
      }
      toast.success(t('Settings updated successfully'))
    } catch {
      toast.error(t('Failed to update settings'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      title={t('XunhuPay (Hupijiao)')}
      description={t(
        'Configure WeChat/Alipay top-up via XunhuPay. Leave Alipay credentials empty to hide that option.'
      )}
    >
      <Alert className='mb-4'>
        <AlertDescription>
          {t('Callback URL')}:{' '}
          <code className='text-xs'>/api/xunhu/notify</code>
          <br />
          {t('Docs')}:{' '}
          <a
            href='https://www.xunhupay.com/doc/api/pay.html'
            target='_blank'
            rel='noreferrer'
            className='underline'
          >
            xunhupay.com
          </a>
        </AlertDescription>
      </Alert>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <Label>{t('Enable XunhuPay')}</Label>
          <Switch
            checked={form.watch('XunhuEnabled')}
            onCheckedChange={(v) => form.setValue('XunhuEnabled', v)}
          />
        </div>

        <div className='space-y-2'>
          <Label>{t('Gateway URL')}</Label>
          <Input {...form.register('XunhuGatewayUrl')} />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>{t('WeChat AppID')}</Label>
            <Input {...form.register('XunhuWxAppId')} />
          </div>
          <div className='space-y-2'>
            <Label>{t('WeChat AppSecret')}</Label>
            <Input
              type='password'
              placeholder={t('Leave blank to keep unchanged')}
              {...form.register('XunhuWxAppSecret')}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Alipay AppID')}</Label>
            <Input {...form.register('XunhuAliAppId')} />
          </div>
          <div className='space-y-2'>
            <Label>{t('Alipay AppSecret')}</Label>
            <Input
              type='password'
              placeholder={t('Leave blank to keep unchanged')}
              {...form.register('XunhuAliAppSecret')}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Unit Price (CNY)')}</Label>
            <Input
              type='number'
              step='0.01'
              {...form.register('XunhuUnitPrice', { valueAsNumber: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Minimum Top-up')}</Label>
            <Input
              type='number'
              {...form.register('XunhuMinTopUp', { valueAsNumber: true })}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? t('Saving...') : t('Save XunhuPay settings')}
        </Button>
      </div>
    </SettingsSection>
  )
}
