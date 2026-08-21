/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useEffect, useMemo, useRef } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOptionsBulk } from '../hooks/use-update-option'

const schema = z.object({
  registration_country: z.object({
    enabled: z.boolean(),
    blocked_countries: z.string(),
    auto_disable_countries: z.string(),
  }),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

type Defaults = {
  'registration_country.enabled': boolean
  'registration_country.blocked_countries': string[]
  'registration_country.auto_disable_countries': string[]
}

function toLines(values: string[]): string {
  return values.join('\n')
}

function toCountries(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

function buildDefaults(defaults: Defaults): FormInput {
  return {
    registration_country: {
      enabled: defaults['registration_country.enabled'],
      blocked_countries: toLines(
        defaults['registration_country.blocked_countries']
      ),
      auto_disable_countries: toLines(
        defaults['registration_country.auto_disable_countries']
      ),
    },
  }
}

function normalize(values: FormValues): Defaults {
  return {
    'registration_country.enabled': values.registration_country.enabled,
    'registration_country.blocked_countries': toCountries(
      values.registration_country.blocked_countries
    ),
    'registration_country.auto_disable_countries': toCountries(
      values.registration_country.auto_disable_countries
    ),
  }
}

export function RegistrationCountrySection(props: { defaultValues: Defaults }) {
  const { t } = useTranslation()
  const updateOptions = useUpdateOptionsBulk()
  const formDefaults = useMemo(
    () => buildDefaults(props.defaultValues),
    [props.defaultValues]
  )
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
  })
  const baselineRef = useRef<Defaults>(props.defaultValues)
  const baselineSerializedRef = useRef(JSON.stringify(props.defaultValues))

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildDefaults(props.defaultValues))
  }, [form, props.defaultValues])

  const onSubmit = async (values: FormValues) => {
    const normalized = normalize(values)
    const changedKeys = (
      Object.keys(normalized) as Array<keyof Defaults>
    ).filter(
      (key) =>
        JSON.stringify(normalized[key]) !==
        JSON.stringify(baselineRef.current[key])
    )
    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    const response = await updateOptions.mutateAsync({
      options: changedKeys.map((key) => ({
        key,
        value:
          typeof normalized[key] === 'boolean'
            ? String(normalized[key])
            : JSON.stringify(normalized[key]),
      })),
    })
    if (!response.success) return
    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildDefaults(normalized))
  }

  return (
    <Form {...form}>
      <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
        <SettingsPageFormActions
          onSave={form.handleSubmit(onSubmit)}
        isSaving={updateOptions.isPending}
        />
        <div data-settings-form-span='full'>
          <h4 className='font-medium'>{t('Country registration rules')}</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Control which countries can register and which new accounts should be disabled immediately.'
            )}
          </p>
        </div>
        <FormField
          control={form.control}
          name='registration_country.enabled'
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t('Enable country registration rules')}</FormLabel>
                <FormDescription>
                  {t('Apply these rules to password and OAuth registration.')}
                </FormDescription>
              </SettingsSwitchContent>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </SettingsSwitchItem>
          )}
        />
        <FormField
          control={form.control}
          name='registration_country.blocked_countries'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Blocked countries')}</FormLabel>
              <FormControl>
                <Textarea rows={5} placeholder='MA\nDZ' {...field} />
              </FormControl>
              <FormDescription>
                {t('ISO alpha-2 codes, one per line. Registration is rejected.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='registration_country.auto_disable_countries'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Auto-disable countries')}</FormLabel>
              <FormControl>
                <Textarea rows={5} placeholder='MA' {...field} />
              </FormControl>
              <FormDescription>
                {t('ISO alpha-2 codes, one per line. Accounts are created disabled.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </SettingsForm>
    </Form>
  )
}
