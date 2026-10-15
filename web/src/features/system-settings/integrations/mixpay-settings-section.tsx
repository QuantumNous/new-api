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
  payee_id: z.string(),
  settlement_asset_id: z.string(),
  strict_mode: z.boolean(),
  notify_base_url: z.string(),
  return_url: z.string(),
  min_topup: z.number().int().min(1).max(1000000),
  ttl_seconds: z.number().int().min(60).max(86400),
})
type Config = z.infer<typeof schema>

export function MixPaySettingsSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['mixpay-config'],
    queryFn: async (): Promise<Config> =>
      requireServerSuccess((await api.get('/api/option/mixpay')).data).data
        .config,
  })
  if (query.isPending) return <LoadingState />
  if (!query.data) {
    return <Button onClick={() => void query.refetch()}>{t('Retry')}</Button>
  }
  return <MixPayConfigForm key={query.data.id} config={query.data} />
}

function MixPayConfigForm(props: { config: Config }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const verification = useSecureVerification()
  const form = useForm<Config>({
    resolver: zodResolver(schema),
    defaultValues: props.config,
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
        scope: 'payment.mixpay.configure',
        context: { config_hash: configHash },
      })
      if (!proof) return false
      requireServerSuccess(
        (
          await api.put('/api/option/mixpay', body, {
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
        await client.invalidateQueries({ queryKey: ['mixpay-config'] })
      }
    },
    onError: (error) => handleServerError(error),
  })
  const fields = [
    { name: 'payee_id' as const, label: t('MixPay payee ID') },
    {
      name: 'settlement_asset_id' as const,
      label: t('MixPay settlement asset ID'),
    },
    { name: 'notify_base_url' as const, label: t('Notification base URL') },
    { name: 'return_url' as const, label: t('Return URL') },
  ]
  return (
    <>
      <div className='space-y-5' data-no-autosubmit='true'>
        <h3 className='text-lg font-medium'>MixPay</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Accept cryptocurrency payments for wallet topups and subscriptions. Orders are priced in USD.'
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
            <FormField
              control={form.control}
              name='strict_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Require the selected settlement asset')}
                  </FormLabel>
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
                      <Input {...field} />
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
            <FormField
              control={form.control}
              name='ttl_seconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Payment window (seconds)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={60}
                      max={86400}
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
