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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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

type OfficialFallbackSettingsValues = z.output<typeof schema>
type OfficialFallbackSettingsInput = z.input<typeof schema>

const emptyPolicy: OfficialFallbackSettingsValues['policies'][number] = {
  enabled: true,
  model_id: '',
  fallback_after: 1,
  official_channel_id: 0,
}

function normalizePolicy(
  policy: OfficialFallbackSettingsInput['policies'][number]
): OfficialFallbackSettingsValues['policies'][number] {
  return {
    enabled: Boolean(policy.enabled),
    model_id: String(policy.model_id ?? '').trim(),
    fallback_after: Number(policy.fallback_after ?? 0),
    official_channel_id: Number(policy.official_channel_id ?? 0),
  }
}

function normalizeValues(
  values: OfficialFallbackSettingsInput
): OfficialFallbackSettingsValues {
  return {
    policies: Array.isArray(values.policies)
      ? values.policies.map(normalizePolicy)
      : [],
  }
}

type ParseOfficialFallbackSettingsResult = {
  values: OfficialFallbackSettingsValues
  error: string
}

function parseOfficialFallbackSettings(
  rawValue: string
): ParseOfficialFallbackSettingsResult {
  const fallback: OfficialFallbackSettingsValues = { policies: [] }
  const trimmed = (rawValue ?? '').toString().trim()

  if (!trimmed) {
    return {
      values: fallback,
      error: '',
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | OfficialFallbackSettingsInput['policies']
      | {
          policies?: Array<OfficialFallbackSettingsInput['policies'][number]>
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
  values: OfficialFallbackSettingsValues
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
}: {
  defaultValue: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const parsedResult = useMemo(
    () => parseOfficialFallbackSettings(defaultValue),
    [defaultValue]
  )
  const parsedDefaults = parsedResult.values

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
    const nextSerialized = serializeOfficialFallbackSettings(values)
    const defaultSerialized = serializeOfficialFallbackSettings(parsedDefaults)

    if (nextSerialized === defaultSerialized) {
      toast.info(t('No changes to save'))
      return
    }

    await updateOption.mutateAsync({
      key: 'model_fallback_setting',
      value: nextSerialized,
    })

    form.reset(values)
  }

  return (
    <SettingsSection
      title={t('Official Fallback')}
      description={t(
        'Configure which request model IDs switch to an official fallback channel after a number of failed attempts.'
      )}
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
              <p className="text-sm font-medium">
                {t('Official fallback rules')}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(
                  'Use request model IDs such as gpt-5.4. Official channel ID is the numeric ID shown in the Model Data channel list.'
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

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,1.4fr)_140px_160px_auto] md:items-start"
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`policies.${index}.enabled`}
                      render={({ field: enabledField }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border px-3 py-2">
                          <div className="space-y-0.5">
                            <FormLabel>{t('Enabled')}</FormLabel>
                            <FormDescription>
                              {t('Turn this fallback rule on or off')}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={enabledField.value}
                              onCheckedChange={enabledField.onChange}
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`policies.${index}.model_id`}
                      render={({ field: modelField }) => (
                        <FormItem>
                          <FormLabel>{t('Model ID')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="gpt-5.4"
                              {...modelField}
                              value={modelField.value ?? ''}
                              disabled={updateOption.isPending || isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`policies.${index}.fallback_after`}
                    render={({ field: fallbackField }) => (
                      <FormItem>
                        <FormLabel>{t('Fallback After')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...fallbackField}
                            value={fallbackField.value ?? 0}
                            onChange={(event) =>
                              fallbackField.onChange(event.target.value)
                            }
                            disabled={updateOption.isPending || isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'How many normal retries should happen before switching to the official fallback channel.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`policies.${index}.official_channel_id`}
                    render={({ field: channelField }) => (
                      <FormItem>
                        <FormLabel>{t('Official Channel ID')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            {...channelField}
                            value={channelField.value ?? ''}
                            onChange={(event) =>
                              channelField.onChange(event.target.value)
                            }
                            disabled={updateOption.isPending || isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'Use the numeric channel ID from the Model Data list'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-start justify-end md:pt-7">
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
