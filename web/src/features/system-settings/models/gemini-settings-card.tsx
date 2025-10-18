import { useEffect, useMemo, useRef } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  formatJsonForTextarea,
  normalizeJsonString,
  validateJsonString,
} from './utils'

const schema = z.object({
  'gemini.safety_settings': z.string().superRefine((value, ctx) => {
    const result = validateJsonString(value)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message || 'Invalid JSON',
      })
    }
  }),
  'gemini.version_settings': z.string().superRefine((value, ctx) => {
    const result = validateJsonString(value)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message || 'Invalid JSON',
      })
    }
  }),
  'gemini.supported_imagine_models': z.string().superRefine((value, ctx) => {
    const result = validateJsonString(value, {
      predicate: (parsed) =>
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string'),
      predicateMessage: 'Expected a JSON array of model identifiers',
    })
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message || 'Invalid JSON array',
      })
    }
  }),
  'gemini.thinking_adapter_enabled': z.boolean(),
  'gemini.thinking_adapter_budget_tokens_percentage': z.coerce
    .number()
    .min(0.002, { message: 'Must be at least 0.002' })
    .max(1, { message: 'Must be 1 or less' }),
})

type GeminiSettingsFormValues = z.infer<typeof schema>

type GeminiSettingsCardProps = {
  defaultValues: GeminiSettingsFormValues
}

export function GeminiSettingsCard({ defaultValues }: GeminiSettingsCardProps) {
  const updateOption = useUpdateOption()
  const normalizedDefaultsRef = useRef({
    'gemini.safety_settings': normalizeJsonString(
      defaultValues['gemini.safety_settings']
    ),
    'gemini.version_settings': normalizeJsonString(
      defaultValues['gemini.version_settings']
    ),
    'gemini.supported_imagine_models': normalizeJsonString(
      defaultValues['gemini.supported_imagine_models']
    ),
    'gemini.thinking_adapter_enabled':
      defaultValues['gemini.thinking_adapter_enabled'],
    'gemini.thinking_adapter_budget_tokens_percentage':
      defaultValues['gemini.thinking_adapter_budget_tokens_percentage'],
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      'gemini.safety_settings': formatJsonForTextarea(
        defaultValues['gemini.safety_settings']
      ),
      'gemini.version_settings': formatJsonForTextarea(
        defaultValues['gemini.version_settings']
      ),
      'gemini.supported_imagine_models': formatJsonForTextarea(
        defaultValues['gemini.supported_imagine_models']
      ),
    },
  })

  useEffect(() => {
    normalizedDefaultsRef.current = {
      'gemini.safety_settings': normalizeJsonString(
        defaultValues['gemini.safety_settings']
      ),
      'gemini.version_settings': normalizeJsonString(
        defaultValues['gemini.version_settings']
      ),
      'gemini.supported_imagine_models': normalizeJsonString(
        defaultValues['gemini.supported_imagine_models']
      ),
      'gemini.thinking_adapter_enabled':
        defaultValues['gemini.thinking_adapter_enabled'],
      'gemini.thinking_adapter_budget_tokens_percentage':
        defaultValues['gemini.thinking_adapter_budget_tokens_percentage'],
    }

    form.reset({
      ...defaultValues,
      'gemini.safety_settings': formatJsonForTextarea(
        defaultValues['gemini.safety_settings']
      ),
      'gemini.version_settings': formatJsonForTextarea(
        defaultValues['gemini.version_settings']
      ),
      'gemini.supported_imagine_models': formatJsonForTextarea(
        defaultValues['gemini.supported_imagine_models']
      ),
    })
  }, [defaultValues, form])

  const isAdapterEnabled = form.watch('gemini.thinking_adapter_enabled')

  const onSubmit = async (values: GeminiSettingsFormValues) => {
    const updates: Array<{ key: keyof GeminiSettingsFormValues; value: any }> =
      []

    const normalized = {
      'gemini.safety_settings': normalizeJsonString(
        values['gemini.safety_settings']
      ),
      'gemini.version_settings': normalizeJsonString(
        values['gemini.version_settings']
      ),
      'gemini.supported_imagine_models': normalizeJsonString(
        values['gemini.supported_imagine_models']
      ),
      'gemini.thinking_adapter_enabled':
        values['gemini.thinking_adapter_enabled'],
      'gemini.thinking_adapter_budget_tokens_percentage':
        values['gemini.thinking_adapter_budget_tokens_percentage'],
    }

    ;(Object.keys(normalized) as Array<keyof GeminiSettingsFormValues>).forEach(
      (key) => {
        if (normalized[key] !== normalizedDefaultsRef.current[key]) {
          updates.push({ key, value: normalized[key] })
        }
      }
    )

    for (const update of updates) {
      await updateOption.mutateAsync({
        key: update.key,
        value: update.value,
      })
    }
  }

  const imaginePlaceholder = useMemo(
    () => JSON.stringify(['gemini-2.0-flash-exp-image-generation'], null, 2),
    []
  )

  return (
    <SettingsAccordion
      value='gemini-settings'
      title='Gemini'
      description='Configure Gemini safety behavior, version overrides, and thinking adapter'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='gemini.safety_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Safety Settings</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  Provide per-category safety overrides as JSON. Use `default`
                  for fallback values.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='gemini.version_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Version Overrides</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  Map model identifiers to Gemini API versions. A `default`
                  entry applies when no specific match is found.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='gemini.supported_imagine_models'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supported Imagine Models</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder={imaginePlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Accepts a JSON array of model identifiers that support the
                  Imagine API.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-4 rounded-lg border p-4'>
            <FormField
              control={form.control}
              name='gemini.thinking_adapter_enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Thinking Adapter
                    </FormLabel>
                    <FormDescription>
                      Supports `-thinking`, `-thinking-{'{{budget}}'}`, and
                      `-nothinking` suffixes while routing to the correct Gemini
                      variant.
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
              name='gemini.thinking_adapter_budget_tokens_percentage'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Tokens Ratio</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={String(field.value ?? '')}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Budget tokens = max tokens × ratio. Accepts a decimal
                    between 0.002 and 1. Recommended to keep aligned with
                    upstream billing.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isAdapterEnabled && (
              <p className='text-muted-foreground text-sm'>
                Gemini will continue to auto-detect thinking mode even with the
                adapter disabled. Enable this only when you need finer control
                over pricing and budgeting.
              </p>
            )}
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
