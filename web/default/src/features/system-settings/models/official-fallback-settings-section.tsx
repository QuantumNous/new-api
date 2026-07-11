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
import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { toast } from 'sonner'
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
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { MODEL_TABS } from '@/features/channel-data/constants'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const policySchema = z.object({
  enabled: z.boolean(),
  model_id: z.string().trim().min(1, 'Model ID is required'),
  fallback_after: z.coerce
    .number()
    .int('Fallback attempts must be an integer')
    .min(0, 'Fallback attempts must be 0 or greater'),
  official_channel_id: z.coerce
    .number()
    .int('Official channel ID must be an integer')
    .positive('Official channel ID must be greater than 0'),
})

const schema = z
  .object({
    RetryTimes: z.coerce.number().int().min(0).max(10),
    policies: z.array(policySchema),
  })
  .superRefine((values, ctx) => {
    const firstIndexByModelID = new Map<string, number>()

    values.policies.forEach((policy, index) => {
      const modelID = policy.model_id.trim()
      if (modelID === '') {
        return
      }
      const previousIndex = firstIndexByModelID.get(modelID)
      if (previousIndex === undefined) {
        firstIndexByModelID.set(modelID, index)
        return
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policies', previousIndex, 'model_id'],
        message: 'Model ID must be unique',
      })
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['policies', index, 'model_id'],
        message: 'Model ID must be unique',
      })
    })
  })

type OfficialFallbackPolicyValues = z.output<typeof policySchema>
type OfficialFallbackPolicyInput = z.input<typeof policySchema>
type OfficialFallbackPoliciesValues = {
  policies: OfficialFallbackPolicyValues[]
}
type OfficialFallbackPoliciesInput = {
  policies: OfficialFallbackPolicyInput[]
}
type OfficialFallbackSettingsValues = z.output<typeof schema>
type OfficialFallbackSettingsInput = z.input<typeof schema>

const emptyPolicy: OfficialFallbackPolicyValues = {
  enabled: true,
  model_id: '',
  fallback_after: 1,
  official_channel_id: 0,
}

function normalizePolicy(
  policy: OfficialFallbackPolicyInput
): OfficialFallbackPolicyValues {
  return {
    enabled: Boolean(policy.enabled),
    model_id: String(policy.model_id ?? '').trim(),
    fallback_after: Number(policy.fallback_after ?? 0),
    official_channel_id: Number(policy.official_channel_id ?? 0),
  }
}

function normalizeValues(
  values: OfficialFallbackPoliciesInput
): OfficialFallbackPoliciesValues {
  return {
    policies: Array.isArray(values.policies)
      ? values.policies.map(normalizePolicy)
      : [],
  }
}

type ParseOfficialFallbackSettingsResult = {
  values: OfficialFallbackPoliciesValues
  error: string
}

function parseOfficialFallbackSettings(
  rawValue: string
): ParseOfficialFallbackSettingsResult {
  const fallback: OfficialFallbackPoliciesValues = { policies: [] }
  const trimmed = (rawValue ?? '').toString().trim()

  if (!trimmed) {
    return {
      values: fallback,
      error: '',
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | OfficialFallbackPolicyInput[]
      | {
          policies?: OfficialFallbackPolicyInput[]
        }
    const policies = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.policies)
        ? parsed.policies
        : []
    return {
      values: normalizeValues({
        policies,
      }),
      error: '',
    }
  } catch (error) {
    return {
      values: fallback,
      error:
        error instanceof Error ? error.message : 'Invalid official fallback JSON',
    }
  }
}

function serializeOfficialFallbackSettings(
  values: OfficialFallbackPoliciesValues
): string {
  return JSON.stringify(
    {
      policies: values.policies.map(normalizePolicy),
    },
    null,
    2
  )
}

export function OfficialFallbackSettingsSection({
  defaultValue,
  defaultRetryTimes,
}: {
  defaultValue: string
  defaultRetryTimes: number
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const modelOptions = useMemo(
    () =>
      MODEL_TABS.map((tab) => ({
        value: tab.modelId,
        label: tab.label,
      })),
    []
  )

  const parsedResult = useMemo(
    () => parseOfficialFallbackSettings(defaultValue),
    [defaultValue]
  )
  const parsedDefaults = useMemo(
    () => ({
      RetryTimes: defaultRetryTimes,
      policies: parsedResult.values.policies,
    }),
    [defaultRetryTimes, parsedResult.values.policies]
  )

  const form = useForm<
    OfficialFallbackSettingsInput,
    unknown,
    OfficialFallbackSettingsValues
  >({
    resolver: zodResolver(schema),
    defaultValues: parsedDefaults as OfficialFallbackSettingsInput,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'policies',
  })

  const { isDirty, isSubmitting } = form.formState

  useEffect(() => {
    form.reset(parsedDefaults as OfficialFallbackSettingsInput)
  }, [form, parsedDefaults])

  const onSubmit = async (values: OfficialFallbackSettingsValues) => {
    const nextSerialized = serializeOfficialFallbackSettings({
      policies: values.policies,
    })
    const defaultSerialized = serializeOfficialFallbackSettings({
      policies: parsedDefaults.policies,
    })
    const retryTimesChanged = values.RetryTimes !== parsedDefaults.RetryTimes

    if (!retryTimesChanged && nextSerialized === defaultSerialized) {
      toast.info(t('No changes to save'))
      return
    }

    if (retryTimesChanged) {
      await updateOption.mutateAsync({
        key: 'RetryTimes',
        value: values.RetryTimes,
      })
    }

    if (nextSerialized !== defaultSerialized) {
      await updateOption.mutateAsync({
        key: 'model_fallback_setting',
        value: nextSerialized,
      })
    }

    form.reset(values)
  }

  return (
    <SettingsSection
      title=''
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {parsedResult.error ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('Official fallback config is invalid')}</AlertTitle>
              <AlertDescription>
                {t(
                  'Current official fallback config could not be parsed. Saving will replace it with the rules below.'
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">{t('Retry Times')}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(
                  'Maximum fallback attempts after failures before the request stops retrying.'
                )}
              </p>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <FormField
                  control={form.control}
                  name='RetryTimes'
                  render={({ field }) => (
                    <FormItem className="max-w-[440px] flex-1 space-y-2">
                      <FormLabel>{t('Retry Times')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={1}
                          value={Number(field.value ?? 0)}
                          onChange={(event) =>
                            field.onChange(event.target.valueAsNumber)
                          }
                          disabled={updateOption.isPending || isSubmitting}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        {t(
                          'Used as the global upper bound for failure fallback retries.'
                        )}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-sm text-amber-600 dark:text-amber-400 lg:max-w-[360px] lg:pt-9">
                  {t(
                    'To trigger official fallback, Retry Times must be greater than Fallback After.'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">
                {t('Official fallback rules')}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(
                  'Use request model IDs such as gpt-5.4. Official channel ID is the numeric ID shown in the Channel Data channel list.'
                )}
              </p>
            </div>

            <div className="space-y-3 p-4">
              {fields.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
                  {t(
                    'No official fallback rules configured. Click "Add Row" to create one.'
                  )}
                </div>
              ) : null}

              {fields.length > 0 ? (
                <div className="hidden grid-cols-[120px_minmax(0,1.5fr)_160px_180px_44px] items-center gap-3 px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:grid">
                  <span>{t('Enabled')}</span>
                  <span>{t('Model ID')}</span>
                  <span>{t('Fallback After')}</span>
                  <span>{t('Official Channel ID')}</span>
                  <span className="text-right">{t('Remove')}</span>
                </div>
              ) : null}

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-border/70 bg-background/60 p-3 shadow-sm transition-colors hover:border-border hover:bg-background"
                >
                  <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1.5fr)_160px_180px_44px] lg:items-start">
                    <FormField
                      control={form.control}
                      name={`policies.${index}.enabled`}
                      render={({ field: enabledField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('Enabled')}
                          </FormLabel>
                          <div className="flex min-h-10 items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 lg:justify-start lg:gap-3">
                            <Switch
                              checked={enabledField.value}
                              onCheckedChange={enabledField.onChange}
                              disabled={updateOption.isPending || isSubmitting}
                            />
                            <span className="text-sm font-medium">
                              {enabledField.value ? t('Enabled') : t('Disabled')}
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`policies.${index}.model_id`}
                      render={({ field: modelField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('Model ID')}
                          </FormLabel>
                          <FormControl>
                            <Combobox
                              options={modelOptions}
                              value={modelField.value ?? ''}
                              onValueChange={(value) =>
                                modelField.onChange(value ?? '')
                              }
                              placeholder={t('Select model from Model Data')}
                              searchPlaceholder={t('Search model')}
                              emptyText={t('No model found')}
                              className="w-full"
                              allowCustomValue
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {t(
                              'Choose from Model Data, or type a custom request model ID if needed.'
                            )}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`policies.${index}.fallback_after`}
                      render={({ field: fallbackField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('Fallback After')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              {...fallbackField}
                              value={Number(fallbackField.value ?? 0)}
                              onChange={(event) =>
                                fallbackField.onChange(event.target.value)
                              }
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Normal fallback attempts before switching.')}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`policies.${index}.official_channel_id`}
                      render={({ field: channelField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('Official Channel ID')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              {...channelField}
                              value={
                                channelField.value == null
                                  ? ''
                                  : Number(channelField.value)
                              }
                              onChange={(event) =>
                                channelField.onChange(event.target.value)
                              }
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Use the numeric channel ID shown in Channel Data.')}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-start justify-end lg:pt-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('Remove fallback rule')}
                        onClick={() => remove(index)}
                        disabled={updateOption.isPending || isSubmitting}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ ...emptyPolicy })}
              disabled={updateOption.isPending || isSubmitting}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('Add Row')}
            </Button>

            <Button
              type="submit"
              disabled={!isDirty || updateOption.isPending || isSubmitting}
            >
              {updateOption.isPending || isSubmitting
                ? t('Saving...')
                : t('Save Changes')}
            </Button>
          </div>
        </form>
      </Form>
    </SettingsSection>
  )
}
