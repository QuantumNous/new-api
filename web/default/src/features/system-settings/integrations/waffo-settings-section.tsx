import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export interface WaffoSettingsValues {
  WaffoEnabled: boolean
  WaffoApiKey: string
  WaffoPrivateKey: string
  WaffoPublicCert: string
  WaffoSandboxPublicCert: string
  WaffoSandboxApiKey: string
  WaffoSandboxPrivateKey: string
  WaffoSandbox: boolean
  WaffoMerchantId: string
  WaffoCurrency: string
  WaffoUnitPrice: number
  WaffoMinTopUp: number
  WaffoNotifyUrl: string
  WaffoReturnUrl: string
  WaffoPayMethods: string
}

interface PayMethod {
  name: string
  icon: string
  payMethodType: string
  payMethodName: string
}

interface Props {
  defaultValues: WaffoSettingsValues
}

export function WaffoSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const iconFileInputRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<Omit<WaffoSettingsValues, 'WaffoPayMethods'>>({
    defaultValues: props.defaultValues,
  })

  const [payMethods, setPayMethods] = useState<PayMethod[]>(() => {
    try {
      return JSON.parse(props.defaultValues.WaffoPayMethods || '[]')
    } catch {
      return []
    }
  })
  const [methodDialogOpen, setMethodDialogOpen] = useState(false)
  const [editingIdx, setEditingIdx] = useState(-1)
  const [methodForm, setMethodForm] = useState<PayMethod>({
    name: '',
    icon: '',
    payMethodType: '',
    payMethodName: '',
  })

  useEffect(() => {
    form.reset(props.defaultValues)
    try {
      setPayMethods(JSON.parse(props.defaultValues.WaffoPayMethods || '[]'))
    } catch {
      setPayMethods([])
    }
  }, [props.defaultValues, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = form.getValues()
      const options: { key: string; value: string }[] = [
        { key: 'WaffoEnabled', value: String(values.WaffoEnabled) },
        { key: 'WaffoSandbox', value: String(values.WaffoSandbox) },
        { key: 'WaffoMerchantId', value: values.WaffoMerchantId || '' },
        { key: 'WaffoCurrency', value: values.WaffoCurrency || 'USD' },
        { key: 'WaffoUnitPrice', value: String(values.WaffoUnitPrice || 1) },
        { key: 'WaffoMinTopUp', value: String(values.WaffoMinTopUp || 1) },
        { key: 'WaffoNotifyUrl', value: values.WaffoNotifyUrl || '' },
        { key: 'WaffoReturnUrl', value: values.WaffoReturnUrl || '' },
        { key: 'WaffoPublicCert', value: values.WaffoPublicCert || '' },
        {
          key: 'WaffoSandboxPublicCert',
          value: values.WaffoSandboxPublicCert || '',
        },
        { key: 'WaffoPayMethods', value: JSON.stringify(payMethods) },
      ]
      if (values.WaffoApiKey)
        options.push({ key: 'WaffoApiKey', value: values.WaffoApiKey })
      if (values.WaffoPrivateKey)
        options.push({ key: 'WaffoPrivateKey', value: values.WaffoPrivateKey })
      if (values.WaffoSandboxApiKey)
        options.push({
          key: 'WaffoSandboxApiKey',
          value: values.WaffoSandboxApiKey,
        })
      if (values.WaffoSandboxPrivateKey)
        options.push({
          key: 'WaffoSandboxPrivateKey',
          value: values.WaffoSandboxPrivateKey,
        })

      for (const opt of options) {
        await updateOption.mutateAsync(opt)
      }
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingIdx(-1)
    setMethodForm({ name: '', icon: '', payMethodType: '', payMethodName: '' })
    setMethodDialogOpen(true)
  }

  const openEdit = (idx: number) => {
    setEditingIdx(idx)
    setMethodForm({ ...payMethods[idx] })
    setMethodDialogOpen(true)
  }

  const saveMethod = () => {
    if (!methodForm.name.trim())
      return toast.error(t('Payment method name is required'))
    if (editingIdx === -1) {
      setPayMethods((prev) => [...prev, methodForm])
    } else {
      setPayMethods((prev) =>
        prev.map((m, i) => (i === editingIdx ? methodForm : m))
      )
    }
    setMethodDialogOpen(false)
  }

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const maxIconSize = 100 * 1024

    if (file.size > maxIconSize) {
      toast.error(t('Icon file must be 100 KB or smaller'))
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      setMethodForm((previous) => ({
        ...previous,
        icon:
          typeof loadEvent.target?.result === 'string'
            ? loadEvent.target.result
            : '',
      }))
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <>
      <SettingsSection
        title={t('Waffo Payment Gateway')}
        description={t(
          'Configure Waffo payment aggregation platform integration'
        )}
      >
        <Alert>
          <AlertDescription className='text-xs'>
            {t(
              'Obtain the API key, merchant ID, and RSA key pair from the Waffo dashboard, and configure the callback URL.'
            )}
          </AlertDescription>
        </Alert>

        <div className='grid grid-cols-2 gap-4'>
          <div className='flex items-center gap-2'>
            <Switch
              checked={form.watch('WaffoEnabled')}
              onCheckedChange={(v) => form.setValue('WaffoEnabled', v)}
            />
            <Label>{t('Enable Waffo')}</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={form.watch('WaffoSandbox')}
              onCheckedChange={(v) => form.setValue('WaffoSandbox', v)}
            />
            <Label>{t('Sandbox mode')}</Label>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('API Key (Production)')}</Label>
            <Input type='password' {...form.register('WaffoApiKey')} />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('API Key (Sandbox)')}</Label>
            <Input type='password' {...form.register('WaffoSandboxApiKey')} />
          </div>
        </div>

        <div className='grid gap-1.5'>
          <Label>{t('Merchant ID')}</Label>
          <Input {...form.register('WaffoMerchantId')} />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('RSA Private Key (Production)')}</Label>
            <Textarea
              rows={3}
              {...form.register('WaffoPrivateKey')}
              className='font-mono text-xs'
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('RSA Private Key (Sandbox)')}</Label>
            <Textarea
              rows={3}
              {...form.register('WaffoSandboxPrivateKey')}
              className='font-mono text-xs'
            />
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Waffo Public Key (Production)')}</Label>
            <Textarea
              rows={3}
              {...form.register('WaffoPublicCert')}
              className='font-mono text-xs'
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Waffo Public Key (Sandbox)')}</Label>
            <Textarea
              rows={3}
              {...form.register('WaffoSandboxPublicCert')}
              className='font-mono text-xs'
            />
          </div>
        </div>

        <div className='grid grid-cols-3 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Currency')}</Label>
            <Input {...form.register('WaffoCurrency')} disabled />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Unit price (USD)')}</Label>
            <Input
              type='number'
              step={0.1}
              min={0}
              {...form.register('WaffoUnitPrice')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Minimum top-up quantity')}</Label>
            <Input type='number' min={1} {...form.register('WaffoMinTopUp')} />
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Callback notification URL')}</Label>
            <Input
              placeholder='https://example.com/api/waffo/webhook'
              {...form.register('WaffoNotifyUrl')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Payment return URL')}</Label>
            <Input
              placeholder='https://example.com/console/topup'
              {...form.register('WaffoReturnUrl')}
            />
          </div>
        </div>

        <Separator />

        <div className='flex items-center justify-between'>
          <h4 className='font-medium'>{t('Payment Methods')}</h4>
          <Button variant='outline' size='sm' onClick={openAdd}>
            <Plus className='mr-1 h-3 w-3' />
            {t('Add payment method')}
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Display name')}</TableHead>
                <TableHead>{t('Icon')}</TableHead>
                <TableHead>{t('Payment method type')}</TableHead>
                <TableHead>{t('Payment method name')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payMethods.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No payment methods configured')}
                  </TableCell>
                </TableRow>
              ) : (
                payMethods.map((m, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>
                      {m.icon ? (
                        <img
                          src={m.icon}
                          alt={m.name}
                          className='h-6 w-6 rounded object-contain'
                        />
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>{m.payMethodType || '-'}</TableCell>
                    <TableCell>{m.payMethodName || '-'}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => openEdit(idx)}
                        >
                          <Pencil className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() =>
                            setPayMethods((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? t('Saving...') : t('Save Changes')}
        </Button>
      </SettingsSection>

      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIdx === -1
                ? t('Add payment method')
                : t('Edit payment method')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Display name')} *</Label>
              <Input
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label>{t('Icon')}</Label>
              <div className='flex items-center gap-3'>
                {methodForm.icon ? (
                  <img
                    src={methodForm.icon}
                    alt={methodForm.name || t('Icon')}
                    className='h-10 w-10 rounded border object-contain p-1'
                  />
                ) : (
                  <div className='bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded border text-xs'>
                    {t('Icon')}
                  </div>
                )}
                <input
                  ref={iconFileInputRef}
                  type='file'
                  accept='image/png,image/jpeg,image/svg+xml,image/webp'
                  className='hidden'
                  onChange={handleIconFileChange}
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => iconFileInputRef.current?.click()}
                >
                  {t('Upload')}
                </Button>
                {methodForm.icon ? (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() =>
                      setMethodForm((previous) => ({
                        ...previous,
                        icon: '',
                      }))
                    }
                  >
                    {t('Clear')}
                  </Button>
                ) : null}
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Supports PNG, JPG, SVG, or WebP. Recommended size: 128×128 or smaller.'
                )}
              </p>
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Payment method type')}</Label>
              <Input
                value={methodForm.payMethodType}
                onChange={(e) =>
                  setMethodForm((p) => ({
                    ...p,
                    payMethodType: e.target.value,
                  }))
                }
                placeholder='CREDITCARD,DEBITCARD'
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Payment method name')}</Label>
              <Input
                value={methodForm.payMethodName}
                onChange={(e) =>
                  setMethodForm((p) => ({
                    ...p,
                    payMethodName: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setMethodDialogOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={saveMethod}>{t('Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
