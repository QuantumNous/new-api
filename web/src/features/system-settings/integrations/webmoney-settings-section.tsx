import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

const schema = z.object({
  id: z.number(),
  enabled: z.boolean(),
  purse: z.string(),
  wmid: z.string().regex(/^([0-9]{12})?$/),
  description: z.string(),
  rate: z.string(),
  secret: z.string(),
  notify_base_url: z.string(),
  return_url: z.string(),
  min_topup: z.number().int().min(1).max(1000000),
})
type Config = z.infer<typeof schema>

export function WebMoneySettingsSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['webmoney-config'],
    queryFn: async (): Promise<Config> =>
      requireServerSuccess((await api.get('/api/option/webmoney')).data).data
        .config,
  })
  if (query.isPending) return <LoadingState />
  if (!query.data) {
    return <Button onClick={() => void query.refetch()}>{t('Retry')}</Button>
  }
  return <WebMoneyConfigForm key={query.data.id} config={query.data} />
}

function WebMoneyConfigForm(props: { config: Config }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const verification = useSecureVerification()
  const form = useForm<Config>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...props.config,
      wmid: props.config.wmid ?? '',
      secret: '',
    },
  })
  const save = useMutation({
    mutationFn: async (values: Config) => {
      const body = JSON.stringify(values)
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(body)
      )
      const configHash = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0')
      ).join('')
      const proof = await verification.requestVerification({
        scope: 'payment.webmoney.configure',
        context: { config_hash: configHash },
      })
      if (!proof) return false
      requireServerSuccess(
        (
          await api.put('/api/option/webmoney', body, {
            headers: {
              'Content-Type': 'application/json',
              'X-Security-Proof': proof.proof_token,
            },
          })
        ).data
      )
      return true
    },
    onSuccess: async (saved) => {
      if (saved) {
        toast.success(t('Saved successfully'))
        await client.invalidateQueries({ queryKey: ['webmoney-config'] })
      }
    },
    onError: (error) => handleServerError(error),
  })
  const fields = [
    { name: 'wmid' as const, label: t('WebMoney merchant WMID') },
    { name: 'purse' as const, label: t('WebMoney purse') },
    { name: 'description' as const, label: t('Payment description') },
    { name: 'rate' as const, label: t('WMT per USD') },
    { name: 'secret' as const, label: t('WebMoney Secret Key') },
    { name: 'notify_base_url' as const, label: t('Notification base URL') },
    { name: 'return_url' as const, label: t('Return URL') },
  ]
  return (
    <>
      <div className='space-y-5' data-no-autosubmit='true'>
        <h3 className='text-lg font-medium'>WebMoney</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Accept WMT wallet topups. The exchange rate defaults to 1 WMT per USD.'
          )}
        </p>
        <p className='text-muted-foreground text-sm break-words'>
          {t(
            'Leave Secret Key blank to keep the saved key. Use SHA256 notifications in WebMoney Merchant, enable preliminary request parameters, and leave payment form signature disabled.'
          )}
        </p>
        <p className='text-muted-foreground text-sm break-all'>
          Result URL: {form.watch('notify_base_url').replace(/\/$/, '')}
          /api/user/webmoney/notify
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Set Success URL and Fail URL to the Return URL below. Use work mode; test payments never credit your wallet.'
          )}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Enter the 12-digit WMID of the receiving purse owner to enable X18 payment queries. Uses Secret Key, not Secret Key X20.'
          )}
        </p>
        <Form {...form}>
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Enable')}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fields.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{item.label}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={item.name === 'secret' ? 'password' : 'text'}
                        autoComplete={
                          item.name === 'secret' ? 'new-password' : undefined
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name='min_topup'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum Top-up Amount')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type='button'
            className='mt-4'
            disabled={save.isPending}
            onClick={() =>
              void form.handleSubmit((values) => save.mutate(values))()
            }
          >
            {t('Save')}
          </Button>
        </Form>
      </div>
      <SecureVerificationDialog {...verification.dialogProps} />
    </>
  )
}
