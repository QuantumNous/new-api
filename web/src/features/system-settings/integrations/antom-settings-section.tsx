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
import { Textarea } from '@/components/ui/textarea'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { PaymentMethodLabel } from '@/features/wallet/components/payment-method-label'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

const schema = z.object({
  id: z.number(),
  enabled: z.boolean(),
  client_id: z.string(),
  region: z.enum(['SG', 'US', 'DE']),
  sandbox: z.boolean(),
  public_key: z.string(),
  settlement_currency: z.string(),
  description: z.string(),
  secret: z.string(),
  notify_base_url: z.string(),
  return_url: z.string(),
  min_topup: z.number().int().min(1).max(1000000),
})
type Config = z.infer<typeof schema>

export function AntomSettingsSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['antom-config'],
    queryFn: async (): Promise<Config> =>
      requireServerSuccess((await api.get('/api/option/antom')).data).data
        .config,
  })
  if (query.isPending) return <LoadingState />
  if (!query.data) {
    return <Button onClick={() => void query.refetch()}>{t('Retry')}</Button>
  }
  return <AntomConfigForm key={query.data.id} config={query.data} />
}

function AntomConfigForm(props: { config: Config }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const verification = useSecureVerification()
  const form = useForm<Config>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...props.config,

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
        scope: 'payment.antom.configure',
        context: { config_hash: configHash },
      })
      if (!proof) return false
      requireServerSuccess(
        (
          await api.put('/api/option/antom', body, {
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
        await client.invalidateQueries({ queryKey: ['antom-config'] })
      }
    },
    onError: (error) => handleServerError(error),
  })
  const fields = [
    { name: 'client_id' as const, label: t('Client ID') },
    { name: 'region' as const, label: t('Antom region (SG, US or DE)') },
    { name: 'public_key' as const, label: t('Antom public key') },
    { name: 'settlement_currency' as const, label: t('Settlement currency') },
    { name: 'description' as const, label: t('Payment description') },
    { name: 'secret' as const, label: t('Merchant private key') },
    { name: 'notify_base_url' as const, label: t('Notification base URL') },
    { name: 'return_url' as const, label: t('Return URL') },
  ]
  return (
    <>
      <div className='space-y-5' data-no-autosubmit='true'>
        <h3 className='text-lg font-medium'>
          <PaymentMethodLabel method='antom' />
        </h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Antom accepts USD top-ups. Configure the matching Client ID, merchant private key and Antom public key. Leave the private key blank to keep the saved key.'
          )}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Sandbox payments are restricted to the root administrator for testing. Production payments require live merchant credentials.'
          )}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Antom Hosted Checkout is enabled. Google Pay merchant registration and Apple Pay domain verification are not required on this site. Payment methods depend on your Antom account.'
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
              name='sandbox'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Sandbox')}</FormLabel>
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
                      {item.name === 'secret' || item.name === 'public_key' ? (
                        <Textarea
                          {...field}
                          autoComplete='off'
                          spellCheck={false}
                          className='font-mono text-xs'
                        />
                      ) : (
                        <Input {...field} />
                      )}
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
