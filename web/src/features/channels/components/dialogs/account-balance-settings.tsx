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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  getAccountBalanceConfig,
  saveAccountBalanceConfig,
  type AccountBalanceConfig,
} from '../../api'
import {
  accountBalanceFormSchema,
  type AccountBalanceFormValues,
} from '../../lib/channel-balance'

interface AccountBalanceSettingsProps {
  channelId: number
  disabled: boolean
  onSaved: () => void
  onBusyChange: (busy: boolean) => void
}

export function AccountBalanceSettings(props: AccountBalanceSettingsProps) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['channel-account-balance', props.channelId],
    queryFn: () => getAccountBalanceConfig(props.channelId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })
  return (
    <details className='rounded-lg border p-3'>
      <summary className='cursor-pointer font-medium'>
        {t('Account balance settings')}
      </summary>
      {query.isPending && <p className='py-3'>{t('Loading...')}</p>}
      {query.isError && (
        <div className='space-y-2 py-3'>
          <p role='alert'>{t('Failed to load account balance settings')}</p>
          <Button variant='outline' onClick={() => void query.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      {query.data && <AccountBalanceForm {...props} initial={query.data} />}
    </details>
  )
}

export function AccountBalanceForm(
  props: AccountBalanceSettingsProps & { initial: AccountBalanceConfig }
) {
  const { t } = useTranslation()
  const id = useId()
  const form = useForm<AccountBalanceFormValues>({
    resolver: zodResolver(accountBalanceFormSchema),
    defaultValues: {
      enabled: props.initial.enabled,
      base_url: props.initial.base_url,
      user_id: props.initial.user_id,
      access_token: '',
      has_saved_token: props.initial.has_access_token,
    },
  })
  const enabled = useWatch({ control: form.control, name: 'enabled' })
  const hasToken = useWatch({ control: form.control, name: 'has_saved_token' })
  const [saved, setSaved] = useState(false)
  const mutation = useMutation({
    mutationFn: (values: AccountBalanceFormValues) =>
      saveAccountBalanceConfig(props.channelId, {
        enabled: values.enabled,
        base_url: values.base_url,
        user_id: values.user_id,
        access_token: values.access_token,
      }),
    onMutate: () => {
      props.onBusyChange(true)
      setSaved(false)
    },
    onSuccess: (_, values) => {
      form.reset({
        ...values,
        access_token: '',
        has_saved_token: values.enabled,
      })
      setSaved(true)
      props.onSaved()
    },
    onSettled: () => props.onBusyChange(false),
  })
  const disabled = props.disabled || mutation.isPending
  return (
    <form
      className='space-y-3 pt-3'
      noValidate
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <p className='text-muted-foreground text-sm'>
        {t(
          'Read the New API account wallet using a separate access token. Amounts keep the upstream currency. Automatic balance refresh also uses these settings.'
        )}
      </p>
      <div className='flex items-center gap-2'>
        <Switch
          id={`${id}-enabled`}
          checked={enabled}
          onCheckedChange={(checked) => form.setValue('enabled', checked)}
          disabled={disabled}
        />
        <Label htmlFor={`${id}-enabled`}>
          {t('Use account wallet balance')}
        </Label>
      </div>
      {enabled && (
        <>
          <div className='space-y-1'>
            <Label htmlFor={`${id}-url`}>{t('Upstream account site')}</Label>
            <Input
              id={`${id}-url`}
              type='url'
              placeholder='https://goeasyapi.xyz'
              {...form.register('base_url')}
              aria-invalid={!!form.formState.errors.base_url}
              required
              disabled={disabled}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor={`${id}-user`}>{t('Upstream user ID')}</Label>
            <Input
              id={`${id}-user`}
              type='number'
              min={1}
              step={1}
              {...form.register('user_id', {
                setValueAs: (value: string) =>
                  value === '' ? 0 : Number(value),
              })}
              aria-invalid={!!form.formState.errors.user_id}
              required
              disabled={disabled}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor={`${id}-token`}>{t('Account access token')}</Label>
            <Input
              id={`${id}-token`}
              type='password'
              autoComplete='new-password'
              {...form.register('access_token')}
              aria-invalid={!!form.formState.errors.access_token}
              required={!hasToken}
              disabled={disabled}
              placeholder={
                hasToken ? t('Leave blank to keep the saved token') : ''
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Use the access token from the upstream profile, not a model API key. Saved tokens are never returned to the browser. Changing the site or user requires entering a token again.'
              )}
            </p>
          </div>
        </>
      )}
      {!enabled && hasToken && (
        <p className='text-muted-foreground text-sm'>
          {t(
            'Saving with account balance disabled removes its saved access token.'
          )}
        </p>
      )}
      {Object.values(form.formState.errors).map((error) => (
        <p
          key={error.message}
          role='alert'
          className='text-destructive text-sm'
        >
          {t(error.message || 'Failed to save account balance settings')}
        </p>
      ))}
      {mutation.isError && (
        <p role='alert' className='text-destructive text-sm'>
          {mutation.error instanceof Error
            ? mutation.error.message
            : t('Failed to save account balance settings')}
        </p>
      )}
      {saved && (
        <p role='status' className='text-sm'>
          {t(
            'Settings saved. Update the balance to verify the upstream wallet.'
          )}
        </p>
      )}
      <Button type='submit' variant='outline' disabled={disabled}>
        {mutation.isPending
          ? t('Saving...')
          : t('Save account balance settings')}
      </Button>
    </form>
  )
}
