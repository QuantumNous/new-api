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
import { CircleDollarSign } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { TitledCard } from '@/components/ui/titled-card'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { updateUpstreamSettings } from './api'
import type { UpstreamRoutingPolicy, UpstreamSettings } from './types'

function parseJSONRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}

function hasUniqueTrimmedKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).map((key) => key.trim())
  return keys.every(Boolean) && new Set(keys).size === keys.length
}

const stringMapText = z.string().refine(
  (value) => {
    const parsed = parseJSONRecord(value)
    return (
      parsed !== undefined &&
      hasUniqueTrimmedKeys(parsed) &&
      Object.values(parsed).every((item) => typeof item === 'string')
    )
  },
  { message: 'Enter a valid JSON object' }
)

const stringListMapText = z.string().refine(
  (value) => {
    const parsed = parseJSONRecord(value)
    return (
      parsed !== undefined &&
      hasUniqueTrimmedKeys(parsed) &&
      Object.values(parsed).every(
        (items) =>
          Array.isArray(items) &&
          items.every(
            (item) => typeof item === 'string' && item.trim().length > 0
          )
      )
    )
  },
  { message: 'Enter a valid JSON object' }
)

const policyFormSchema = z.object({
  targetGroups: z.string().refine(
    (value) =>
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .some(Boolean),
    { message: 'Enter at least one target group' }
  ),
  modelAliases: stringMapText,
  modelExclusions: stringListMapText,
  protocolExclusions: stringListMapText,
})

type PolicyFormValues = z.infer<typeof policyFormSchema>

type PolicySettingsFormProps = {
  settings: UpstreamSettings
  onSaved: () => Promise<unknown>
}

function prettyJSON(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function policyFormValues(settings: UpstreamRoutingPolicy): PolicyFormValues {
  return {
    targetGroups: settings.target_groups.join(', '),
    modelAliases: prettyJSON(settings.model_aliases),
    modelExclusions: prettyJSON(settings.model_exclusions),
    protocolExclusions: prettyJSON(settings.protocol_model_exclusions),
  }
}

function normalizedValues(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const rawValue of values) {
    const value = rawValue.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function normalizedStringMap(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const result: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    if (typeof rawValue !== 'string') continue
    const key = rawKey.trim()
    const value = rawValue.trim()
    if (key) result[key] = value
  }
  return result
}

function normalizedStringListMap(raw: string): Record<string, string[]> {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const result: Record<string, string[]> = {}
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    if (!Array.isArray(rawValue)) continue
    const key = rawKey.trim()
    if (!key) continue
    result[key] = normalizedValues(
      rawValue.filter((value): value is string => typeof value === 'string')
    )
  }
  return result
}

export function PolicySettingsForm(props: PolicySettingsFormProps) {
  const { t } = useTranslation()
  const [serverError, setServerError] = useState<string>()
  const settingsKey = JSON.stringify({
    target_groups: props.settings.target_groups,
    model_aliases: props.settings.model_aliases,
    model_exclusions: props.settings.model_exclusions,
    protocol_model_exclusions: props.settings.protocol_model_exclusions,
  })
  const initialValues = useMemo(
    () => policyFormValues(JSON.parse(settingsKey) as UpstreamRoutingPolicy),
    [settingsKey]
  )
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  })
  const isDirty = form.formState.isDirty
  const appliedSettingsKey = useRef(settingsKey)

  useEffect(() => {
    if (isDirty || appliedSettingsKey.current === settingsKey) return
    form.reset(initialValues)
    appliedSettingsKey.current = settingsKey
    setServerError(undefined)
  }, [form, initialValues, isDirty, settingsKey])

  const save = form.handleSubmit(async (values) => {
    setServerError(undefined)
    const policy: UpstreamRoutingPolicy = {
      target_groups: normalizedValues(values.targetGroups.split(/[,\n]/)),
      model_aliases: normalizedStringMap(values.modelAliases),
      model_exclusions: normalizedStringListMap(values.modelExclusions),
      protocol_model_exclusions: normalizedStringListMap(
        values.protocolExclusions
      ),
    }
    try {
      await updateUpstreamSettings(policy)
      appliedSettingsKey.current = settingsKey
      form.reset(policyFormValues(policy))
      await props.onSaved()
      toast.success(t('Routing policy saved'))
    } catch (error) {
      const message = getServerErrorMessage(error)
      setServerError(message)
      toast.error(message)
    }
  })

  const cancel = () => {
    appliedSettingsKey.current = settingsKey
    form.reset(initialValues)
    setServerError(undefined)
  }

  return (
    <TitledCard
      title={t('Policy')}
      icon={<CircleDollarSign className='size-4' />}
      disableHoverEffect
      titleClassName='text-base'
    >
      <div className='flex flex-col gap-5'>
        <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
          <dt className='text-muted-foreground'>{t('Candidates')}</dt>
          <dd className='text-right font-mono'>
            {props.settings.candidate_limit}
          </dd>
          <dt className='text-muted-foreground'>{t('Failover budget')}</dt>
          <dd className='text-right font-mono'>
            {props.settings.failover_budget_seconds}s
          </dd>
          <dt className='text-muted-foreground'>{t('Breaker')}</dt>
          <dd className='text-right font-mono'>
            {props.settings.failure_threshold}/
            {props.settings.failure_window_minutes}m
          </dd>
          <dt className='text-muted-foreground'>{t('Daily reconcile')}</dt>
          <dd className='text-right font-mono'>
            {props.settings.daily_reconcile_time}
          </dd>
        </dl>
        <Separator />
        <Form {...form}>
          <form className='flex flex-col gap-4' onSubmit={save}>
            <FormField
              control={form.control}
              name='targetGroups'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Target groups')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Comma-separated group names')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='modelAliases'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model aliases (JSON)')}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} className='font-mono' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='modelExclusions'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model exclusions (JSON)')}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} className='font-mono' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='protocolExclusions'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Protocol exclusions (JSON)')}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} className='font-mono' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError ? (
              <Alert variant='destructive'>
                <AlertTitle>{t('Could not save policy')}</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <div className='flex flex-wrap justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                disabled={!isDirty || form.formState.isSubmitting}
                onClick={cancel}
              >
                {t('Cancel changes')}
              </Button>
              <Button
                type='submit'
                disabled={
                  !isDirty ||
                  !form.formState.isValid ||
                  form.formState.isSubmitting
                }
              >
                {form.formState.isSubmitting
                  ? t('Saving...')
                  : t('Save policy')}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </TitledCard>
  )
}
