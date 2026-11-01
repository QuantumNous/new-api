/*
Copyright (C) 2023-2026 QuantumNous
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  parseIPAllowlist,
  partnerServerConfigFormSchema,
  type PartnerServerConfig,
  type PartnerServerConfigFormValues,
} from '../types'

function toFormValues(
  config: PartnerServerConfig
): PartnerServerConfigFormValues {
  return {
    enabled: config.enabled,
    account_group: config.account_group,
    ip_allowlist: config.ip_allowlist.join('\n'),
    max_accounts: config.max_accounts,
    accounts_per_minute: config.accounts_per_minute,
  }
}

export function PartnerServerSettingsForm(props: {
  config: PartnerServerConfig
  groups: string[]
  canWrite: boolean
  submitting: boolean
  onSubmit: (values: PartnerServerConfigFormValues) => void
}) {
  const { t } = useTranslation()
  const form = useForm<PartnerServerConfigFormValues>({
    resolver: zodResolver(partnerServerConfigFormSchema),
    defaultValues: toFormValues(props.config),
  })
  useEffect(() => {
    form.reset(toFormValues(props.config))
  }, [form, props.config])
  const allowlist = useWatch({ control: form.control, name: 'ip_allowlist' })
  const allowlistEmpty = parseIPAllowlist(allowlist ?? '').length === 0

  return (
    <Form {...form}>
      <form
        className='space-y-4'
        onSubmit={form.handleSubmit(props.onSubmit)}
        aria-label={t('Server access settings')}
      >
        <FormField
          control={form.control}
          name='enabled'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between gap-4'>
              <div className='space-y-1'>
                <FormLabel>{t('Enable server access')}</FormLabel>
                <FormDescription>
                  {t(
                    'Lets the partner backend create sub-accounts and keys for its users with a server secret.'
                  )}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!props.canWrite}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='account_group'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Sub-account user group')}</FormLabel>
              <Select
                items={props.groups.map((group) => ({
                  value: group,
                  label: group,
                }))}
                value={field.value}
                onValueChange={field.onChange}
                disabled={!props.canWrite}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Select a user group')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {props.groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormDescription>
                {t(
                  'New sub-accounts join this group. Their keys try this group first, then default.'
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='ip_allowlist'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Allowed source IPs')}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder={'203.0.113.10\n198.51.100.0/24'}
                  disabled={!props.canWrite}
                />
              </FormControl>
              <FormDescription>
                {t(
                  'One IP address or CIDR range per line. Applies to requests that come through the main site entrance.'
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {allowlistEmpty && (
          <Alert variant='destructive'>
            <AlertTitle>{t('No IP allowlist')}</AlertTitle>
            <AlertDescription>
              {t(
                'Anyone holding a server secret can call from any address and read every sub-account key. Add the partner servers’ addresses when possible.'
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='max_accounts'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Sub-account limit')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    min={1}
                    disabled={!props.canWrite}
                    onChange={(event) =>
                      field.onChange(Number.parseInt(event.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='accounts_per_minute'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('New sub-accounts per minute')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    min={1}
                    disabled={!props.canWrite}
                    onChange={(event) =>
                      field.onChange(Number.parseInt(event.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {props.canWrite && (
          <div className='flex justify-end'>
            <Button type='submit' disabled={props.submitting}>
              {t('Save')}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
