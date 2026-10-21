/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  PARTNER_OAUTH_SCOPES,
  partnerOAuthClientFormSchema,
  type PartnerOAuthClient,
  type PartnerOAuthClientFormValues,
} from '../types'

const FORM_ID = 'partner-oauth-client-form'

const AUTH_METHOD_ITEMS = [
  { value: 'client_secret_basic', label: 'Confidential (client_secret_basic)' },
  { value: 'none', label: 'Public native (none)' },
] as const

export function PartnerOAuthClientFormDialog(props: {
  open: boolean
  client?: PartnerOAuthClient | null
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PartnerOAuthClientFormValues) => void
}) {
  const { t } = useTranslation()
  const isEditing = !!props.client
  const form = useForm<PartnerOAuthClientFormValues>({
    resolver: zodResolver(partnerOAuthClientFormSchema),
    defaultValues: {
      name: '',
      token_auth_method: 'client_secret_basic',
      redirect_uris: '',
      scopes: ['account:read', 'credential:read', 'offline_access'],
    },
  })

  useEffect(() => {
    if (!props.open) return
    if (props.client) {
      form.reset({
        name: props.client.name,
        token_auth_method: props.client.token_auth_method,
        redirect_uris: props.client.redirect_uris.join('\n'),
        scopes: props.client.scopes.filter((scope) =>
          PARTNER_OAUTH_SCOPES.includes(
            scope as (typeof PARTNER_OAUTH_SCOPES)[number]
          )
        ) as PartnerOAuthClientFormValues['scopes'],
      })
      return
    }
    form.reset({
      name: '',
      token_auth_method: 'client_secret_basic',
      redirect_uris: '',
      scopes: ['account:read', 'credential:read', 'offline_access'],
    })
  }, [form, props.client, props.open])

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        isEditing
          ? t('Edit partner OAuth client')
          : t('Create partner OAuth client')
      }
      description={t(
        'Register a third-party assistant. Scope and redirect changes apply only to future grants.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={FORM_ID} disabled={props.submitting}>
            {isEditing ? t('Save') : t('Create')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          className='space-y-4'
          onSubmit={form.handleSubmit(props.onSubmit)}
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Application name')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={64}
                    placeholder={t('Assistant name')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='token_auth_method'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Client type')}</FormLabel>
                <Select
                  items={AUTH_METHOD_ITEMS.map((item) => ({
                    value: item.value,
                    label: t(item.label),
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEditing}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {AUTH_METHOD_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {t(item.label)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('Client type cannot be changed after creation.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='redirect_uris'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Redirect URIs')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder='https://assistant.example.com/oauth/callback'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'One URI per line. HTTPS is required, except loopback HTTP for public clients.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='scopes'
            render={() => (
              <FormItem>
                <FormLabel>{t('Allowed scopes')}</FormLabel>
                {PARTNER_OAUTH_SCOPES.map((scope) => (
                  <FormField
                    key={scope}
                    control={form.control}
                    name='scopes'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center gap-2 space-y-0'>
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(scope)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, scope])
                                return
                              }
                              field.onChange(
                                field.value.filter((item) => item !== scope)
                              )
                            }}
                          />
                        </FormControl>
                        <FormLabel className='font-normal'>{scope}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
