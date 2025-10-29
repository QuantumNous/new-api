import { useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsAccordion } from '../components/settings-accordion'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const passkeySchema = z.object({
  'passkey.enabled': z.boolean(),
  'passkey.rp_display_name': z.string(),
  'passkey.rp_id': z.string(),
  'passkey.origins': z.string(),
  'passkey.allow_insecure_origin': z.boolean(),
  'passkey.user_verification': z.enum(['required', 'preferred', 'discouraged']),
  'passkey.attachment_preference': z.enum([
    'none',
    'platform',
    'cross-platform',
  ]),
})

type PasskeyFormValues = z.infer<typeof passkeySchema>

interface PasskeySectionProps {
  defaultValues: PasskeyFormValues
}

export function PasskeySection({ defaultValues }: PasskeySectionProps) {
  const updateOption = useUpdateOption()

  const formDefaults = useMemo<PasskeyFormValues>(
    () => ({
      ...defaultValues,
      'passkey.origins': (defaultValues['passkey.origins'] as string)
        .split(',')
        .map((origin: string) => origin.trim())
        .filter(Boolean)
        .join('\n'),
      'passkey.attachment_preference':
        (defaultValues['passkey.attachment_preference'] as string) === ''
          ? 'none'
          : (defaultValues['passkey.attachment_preference'] as
              | 'platform'
              | 'cross-platform'),
    }),
    [defaultValues]
  )

  const form = useForm<PasskeyFormValues>({
    resolver: zodResolver(passkeySchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async () => {
    const rawData = form.getValues() as Record<string, unknown>
    const flattenedEntries: Array<
      [keyof PasskeyFormValues, PasskeyFormValues[keyof PasskeyFormValues]]
    > = []

    Object.entries(rawData).forEach(([key, value]) => {
      if (key === 'passkey' && value && typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(
          ([nestedKey, nestedValue]) => {
            flattenedEntries.push([
              `passkey.${nestedKey}` as keyof PasskeyFormValues,
              nestedValue as PasskeyFormValues[keyof PasskeyFormValues],
            ])
          }
        )
      } else {
        flattenedEntries.push([
          key as keyof PasskeyFormValues,
          value as PasskeyFormValues[keyof PasskeyFormValues],
        ])
      }
    })

    const data = Object.fromEntries(flattenedEntries) as PasskeyFormValues
    const updates: Array<{ key: string; value: string | boolean }> = []

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'passkey.origins') {
        const processed = (value as string)
          .split('\n')
          .map((origin: string) => origin.trim())
          .filter(Boolean)
          .join(',')
        const currentDefault = defaultValues['passkey.origins'] as string
        if (processed !== currentDefault) {
          updates.push({ key, value: processed })
        }
      } else if (key === 'passkey.attachment_preference') {
        const attachmentPreference =
          value as PasskeyFormValues['passkey.attachment_preference']
        const incoming =
          attachmentPreference === 'none' ? '' : attachmentPreference
        const currentDefault =
          defaultValues['passkey.attachment_preference'] === 'none'
            ? ''
            : defaultValues['passkey.attachment_preference']
        if (incoming !== currentDefault) {
          updates.push({ key, value: incoming })
        }
      } else if (value !== defaultValues[key as keyof PasskeyFormValues]) {
        updates.push({ key, value })
      }
    })

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsAccordion
      value='passkey'
      title='Passkey Authentication'
      description='Configure Passkey (WebAuthn) login settings'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='passkey.enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Enable Passkey</FormLabel>
                  <FormDescription>
                    Allow users to register and sign in with Passkey (WebAuthn)
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.rp_display_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relying Party Display Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g. New API Console'
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  Human-readable name shown to users during Passkey prompts.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.rp_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relying Party ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g. example.com'
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  The effective domain for Passkey registration. Must match the
                  current domain or be its parent domain.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.user_verification'
            render={({ field }) => (
              <FormItem>
                <FormLabel>User Verification</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select requirement' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='required'>Required</SelectItem>
                      <SelectItem value='preferred'>Recommended</SelectItem>
                      <SelectItem value='discouraged'>Discouraged</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Controls whether user verification (biometrics/PIN) is
                  required during Passkey flows.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.attachment_preference'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Device Type Preference</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='No preference' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>Unlimited</SelectItem>
                      <SelectItem value='platform'>Built-in Device</SelectItem>
                      <SelectItem value='cross-platform'>
                        External Device
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Built-in: phone fingerprint/face, or Windows Hello; External:
                  USB security key
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.allow_insecure_origin'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Allow Insecure Origins
                  </FormLabel>
                  <FormDescription>
                    Permit Passkey registration on non-HTTPS origins (only
                    recommended for development)
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='passkey.origins'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Allowed Origins</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder='https://example.com'
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  List of origins (one per line) allowed for Passkey
                  registration and authentication.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit'>Save changes</Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
