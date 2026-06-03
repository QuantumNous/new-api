import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type {
  PaymentConfig,
  PaymentConfigProvider,
} from '@/features/system-settings/types'

type PaymentConfigDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: PaymentConfigProvider
  editData?: PaymentConfig | null
  onSave: (config: PaymentConfig) => Promise<void>
}

const providerDefaults: Record<PaymentConfigProvider, Pick<PaymentConfig, 'name' | 'display_name'>> = {
  alipay: { name: 'Alipay', display_name: '支付宝' },
  wxpay: { name: 'WeChat Pay', display_name: '微信支付' },
}

export function PaymentConfigDialog({
  open,
  onOpenChange,
  provider,
  editData,
  onSave,
}: PaymentConfigDialogProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = React.useState(false)
  const defaults = providerDefaults[provider]
  const [form, setForm] = React.useState<PaymentConfig>({
    provider,
    name: defaults.name,
    display_name: defaults.display_name,
    enabled: false,
    sort_order: provider === 'alipay' ? 10 : 20,
  })

  React.useEffect(() => {
    if (editData) {
      setForm({ ...editData, provider })
    } else {
      setForm({
        provider,
        name: defaults.name,
        display_name: defaults.display_name,
        enabled: false,
        sort_order: provider === 'alipay' ? 10 : 20,
      })
    }
  }, [defaults.display_name, defaults.name, editData, provider])

  const setValue = <K extends keyof PaymentConfig>(
    key: K,
    value: PaymentConfig[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isAlipay = provider === 'alipay'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {isAlipay ? t('Configure Alipay') : t('Configure WeChat Pay')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure merchant credentials used for wallet recharge and subscription purchase.')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-2'>
          <div className='grid gap-2 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>{t('Display name')}</Label>
              <Input
                value={form.display_name || ''}
                onChange={(event) => setValue('display_name', event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('Sort order')}</Label>
              <Input
                type='number'
                value={form.sort_order ?? 0}
                onChange={(event) =>
                  setValue('sort_order', Number(event.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label>{t('Icon URL')}</Label>
            <Input
              value={form.icon_url || ''}
              onChange={(event) => setValue('icon_url', event.target.value)}
              placeholder='https://example.com/payment-icon.png'
            />
          </div>

          {isAlipay ? (
            <>
              <div className='space-y-2'>
                <Label>{t('App ID')}</Label>
                <Input
                  value={form.app_id || ''}
                  onChange={(event) => setValue('app_id', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('App private key')}</Label>
                <Textarea
                  rows={4}
                  value={form.app_private_key || ''}
                  onChange={(event) =>
                    setValue('app_private_key', event.target.value)
                  }
                  placeholder={t('Enter new key to update')}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Alipay public key')}</Label>
                <Textarea
                  rows={4}
                  value={form.alipay_public_key || ''}
                  onChange={(event) =>
                    setValue('alipay_public_key', event.target.value)
                  }
                />
              </div>
              <div className='grid gap-2 sm:grid-cols-3'>
                <div className='space-y-2'>
                  <Label>{t('App public cert')}</Label>
                  <Textarea
                    rows={3}
                    value={form.alipay_app_public_cert || ''}
                    onChange={(event) =>
                      setValue('alipay_app_public_cert', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Alipay public cert')}</Label>
                  <Textarea
                    rows={3}
                    value={form.alipay_public_cert || ''}
                    onChange={(event) =>
                      setValue('alipay_public_cert', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Alipay root cert')}</Label>
                  <Textarea
                    rows={3}
                    value={form.alipay_root_cert || ''}
                    onChange={(event) =>
                      setValue('alipay_root_cert', event.target.value)
                    }
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>{t('App ID')}</Label>
                  <Input
                    value={form.wechat_app_id || ''}
                    onChange={(event) =>
                      setValue('wechat_app_id', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Merchant ID')}</Label>
                  <Input
                    value={form.wechat_mch_id || ''}
                    onChange={(event) =>
                      setValue('wechat_mch_id', event.target.value)
                    }
                  />
                </div>
              </div>
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>{t('APIv3 Key')}</Label>
                  <Input
                    type='password'
                    value={form.wechat_api_key || ''}
                    onChange={(event) =>
                      setValue('wechat_api_key', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label>{t('Certificate Serial No')}</Label>
                  <Input
                    value={form.wechat_serial_no || ''}
                    onChange={(event) =>
                      setValue('wechat_serial_no', event.target.value)
                    }
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label>{t('Merchant private key')}</Label>
                <Textarea
                  rows={4}
                  value={form.wechat_private_key || ''}
                  onChange={(event) =>
                    setValue('wechat_private_key', event.target.value)
                  }
                />
              </div>
            </>
          )}

          <div className='grid gap-2 sm:grid-cols-3'>
            <div className='space-y-2'>
              <Label>{t('Gateway URL')}</Label>
              <Input
                value={form.gateway_url || ''}
                onChange={(event) => setValue('gateway_url', event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('Notify URL')}</Label>
              <Input
                value={form.notify_url || ''}
                onChange={(event) => setValue('notify_url', event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('Return URL')}</Label>
              <Input
                value={form.return_url || ''}
                onChange={(event) => setValue('return_url', event.target.value)}
              />
            </div>
          </div>

          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label>{t('Enable payment gateway')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('Enabled gateways are shown to users on wallet and subscription pages.')}
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => setValue('enabled', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('Saving...') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
