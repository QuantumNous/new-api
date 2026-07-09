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
  frt_timeout_seconds: z.coerce
    .number()
    .int('FRT timeout must be an integer')
    .positive('FRT timeout must be greater than 0'),
  extra_seconds_per_mb: z.coerce
    .number()
    .int('Seconds per MB must be an integer')
    .min(0, 'Seconds per MB must be 0 or greater'),
})

const schema = z
  .object({
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

type ClientGoneFallbackSettingsValues = z.output<typeof schema>
type ClientGoneFallbackSettingsInput = z.input<typeof schema>

const emptyPolicy: ClientGoneFallbackSettingsValues['policies'][number] = {
  enabled: true,
  model_id: '',
  frt_timeout_seconds: 20,
  extra_seconds_per_mb: 10,
}

function normalizePolicy(
  policy: ClientGoneFallbackSettingsInput['policies'][number]
): ClientGoneFallbackSettingsValues['policies'][number] {
  return {
    enabled: Boolean(policy.enabled),
    model_id: String(policy.model_id ?? '').trim(),
    frt_timeout_seconds: Number(policy.frt_timeout_seconds ?? 20),
    extra_seconds_per_mb: Number(policy.extra_seconds_per_mb ?? 0),
  }
}

function normalizeValues(
  values: ClientGoneFallbackSettingsInput
): ClientGoneFallbackSettingsValues {
  return {
    policies: Array.isArray(values.policies)
      ? values.policies.map(normalizePolicy)
      : [],
  }
}

type ParseClientGoneFallbackSettingsResult = {
  values: ClientGoneFallbackSettingsValues
  error: string
}

function parseClientGoneFallbackSettings(
  rawValue: string
): ParseClientGoneFallbackSettingsResult {
  const fallback: ClientGoneFallbackSettingsValues = { policies: [] }
  const trimmed = (rawValue ?? '').toString().trim()

  if (!trimmed) {
    return {
      values: fallback,
      error: '',
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | ClientGoneFallbackSettingsInput['policies']
      | {
          policies?: Array<
            ClientGoneFallbackSettingsInput['policies'][number]
          >
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
        error instanceof Error
          ? error.message
          : 'Invalid clientgone fallback JSON',
    }
  }
}

function serializeClientGoneFallbackSettings(
  values: ClientGoneFallbackSettingsValues
): string {
  return JSON.stringify(
    {
      policies: values.policies.map(normalizePolicy),
    },
    null,
    2
  )
}

export function ClientGoneFallbackSettingsSection({
  defaultValue,
}: {
  defaultValue: string
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
    () => parseClientGoneFallbackSettings(defaultValue),
    [defaultValue]
  )
  const parsedDefaults = parsedResult.values

  const form = useForm<
    ClientGoneFallbackSettingsInput,
    unknown,
    ClientGoneFallbackSettingsValues
  >({
    resolver: zodResolver(schema),
    defaultValues: parsedDefaults as ClientGoneFallbackSettingsInput,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'policies',
  })

  const { isDirty, isSubmitting } = form.formState

  useEffect(() => {
    form.reset(parsedDefaults as ClientGoneFallbackSettingsInput)
  }, [form, parsedDefaults])

  const onSubmit = async (values: ClientGoneFallbackSettingsValues) => {
    const nextSerialized = serializeClientGoneFallbackSettings(values)
    const defaultSerialized =
      serializeClientGoneFallbackSettings(parsedDefaults)

    if (nextSerialized === defaultSerialized) {
      toast.info(t('No changes to save'))
      return
    }

    await updateOption.mutateAsync({
      key: 'clientgone_fallback_setting',
      value: nextSerialized,
    })

    form.reset(values)
  }

  return (
    <SettingsSection
      title={t('ClientGone Fallback')}
      description={t(
        'Race to a second channel when the primary channel produces no first byte within the threshold. Threshold = FRT seconds + seconds per MB × request body size.'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {parsedResult.error ? (
            <Alert variant='destructive'>
              <AlertTitle>
                {t('ClientGone fallback config is invalid')}
              </AlertTitle>
              <AlertDescription>
                {t(
                  'Current clientgone fallback config could not be parsed. Saving will replace it with the rules below.'
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">
                {t('ClientGone fallback rules')}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(
                  'First byte race: the winner streams to the client, the loser is canceled and not billed to the user.'
                )}
              </p>
            </div>

            <div className="space-y-3 p-4">
              {fields.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
                  {t(
                    'No clientgone fallback rules configured. Click "Add Row" to create one.'
                  )}
                </div>
              ) : null}

              {fields.length > 0 ? (
                <div className="hidden grid-cols-[120px_minmax(0,1.5fr)_160px_180px_44px] items-center gap-3 px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:grid">
                  <span>{t('Enabled')}</span>
                  <span>{t('Model ID')}</span>
                  <span>{t('FRT Timeout (s)')}</span>
                  <span>{t('Extra Seconds per MB')}</span>
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
                      name={`policies.${index}.frt_timeout_seconds`}
                      render={({ field: frtField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('FRT Timeout (s)')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              {...frtField}
                              value={frtField.value ?? 20}
                              onChange={(event) =>
                                frtField.onChange(event.target.value)
                              }
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {t(
                              'Seconds to wait for the first byte before racing a second channel.'
                            )}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`policies.${index}.extra_seconds_per_mb`}
                      render={({ field: perMbField }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs text-muted-foreground lg:sr-only">
                            {t('Extra Seconds per MB')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              {...perMbField}
                              value={perMbField.value ?? 0}
                              onChange={(event) =>
                                perMbField.onChange(event.target.value)
                              }
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {t(
                              'Extra threshold seconds added per MB of request body. 0 disables scaling.'
                            )}
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
