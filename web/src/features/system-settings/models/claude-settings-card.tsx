import { useEffect, useRef } from 'react'
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
  'claude.model_headers_settings': z.string().superRefine((value, ctx) => {
    const result = validateJsonString(value)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message || 'Invalid JSON',
      })
    }
  }),
  'claude.default_max_tokens': z.string().superRefine((value, ctx) => {
    const result = validateJsonString(value)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message || 'Invalid JSON',
      })
    }
  }),
  'claude.thinking_adapter_enabled': z.boolean(),
  'claude.thinking_adapter_budget_tokens_percentage': z.coerce
    .number()
    .min(0.1, { message: 'Must be at least 0.1' })
    .max(1, { message: 'Must be 1 or less' }),
})

type ClaudeSettingsFormValues = z.infer<typeof schema>

type ClaudeSettingsCardProps = {
  defaultValues: ClaudeSettingsFormValues
}

export function ClaudeSettingsCard({ defaultValues }: ClaudeSettingsCardProps) {
  const updateOption = useUpdateOption()
  const normalizedDefaultsRef = useRef({
    'claude.model_headers_settings': normalizeJsonString(
      defaultValues['claude.model_headers_settings']
    ),
    'claude.default_max_tokens': normalizeJsonString(
      defaultValues['claude.default_max_tokens']
    ),
    'claude.thinking_adapter_enabled':
      defaultValues['claude.thinking_adapter_enabled'],
    'claude.thinking_adapter_budget_tokens_percentage':
      defaultValues['claude.thinking_adapter_budget_tokens_percentage'],
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      'claude.model_headers_settings': formatJsonForTextarea(
        defaultValues['claude.model_headers_settings']
      ),
      'claude.default_max_tokens': formatJsonForTextarea(
        defaultValues['claude.default_max_tokens']
      ),
    },
  })

  useEffect(() => {
    normalizedDefaultsRef.current = {
      'claude.model_headers_settings': normalizeJsonString(
        defaultValues['claude.model_headers_settings']
      ),
      'claude.default_max_tokens': normalizeJsonString(
        defaultValues['claude.default_max_tokens']
      ),
      'claude.thinking_adapter_enabled':
        defaultValues['claude.thinking_adapter_enabled'],
      'claude.thinking_adapter_budget_tokens_percentage':
        defaultValues['claude.thinking_adapter_budget_tokens_percentage'],
    }

    form.reset({
      ...defaultValues,
      'claude.model_headers_settings': formatJsonForTextarea(
        defaultValues['claude.model_headers_settings']
      ),
      'claude.default_max_tokens': formatJsonForTextarea(
        defaultValues['claude.default_max_tokens']
      ),
    })
  }, [defaultValues, form])

  const onSubmit = async (values: ClaudeSettingsFormValues) => {
    const normalized = {
      'claude.model_headers_settings': normalizeJsonString(
        values['claude.model_headers_settings']
      ),
      'claude.default_max_tokens': normalizeJsonString(
        values['claude.default_max_tokens']
      ),
      'claude.thinking_adapter_enabled':
        values['claude.thinking_adapter_enabled'],
      'claude.thinking_adapter_budget_tokens_percentage':
        values['claude.thinking_adapter_budget_tokens_percentage'],
    }

    const updates = (
      Object.keys(normalized) as Array<keyof ClaudeSettingsFormValues>
    ).filter((key) => normalized[key] !== normalizedDefaultsRef.current[key])

    for (const key of updates) {
      await updateOption.mutateAsync({ key, value: normalized[key] })
    }
  }

  return (
    <SettingsAccordion
      value='claude-settings'
      title='Claude'
      description='Override Anthropic headers, defaults, and thinking adapter behavior'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='claude.model_headers_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Request Header Overrides</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  Provide per-model header overrides as JSON. Useful for
                  enabling beta features such as expanded context windows.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='claude.default_max_tokens'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Max Tokens</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  Example{' '}
                  {`{ "default": 8192, "claude-3-haiku-20240307": 4096, "claude-3-opus-20240229": 4096, "claude-3-7-sonnet-20250219-thinking": 8192 }`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-4 rounded-lg border p-4'>
            <FormField
              control={form.control}
              name='claude.thinking_adapter_enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Thinking Adapter
                    </FormLabel>
                    <FormDescription>
                      Translate `-thinking` suffixes into Anthropic native
                      thinking models while keeping pricing predictable.
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
              name='claude.thinking_adapter_budget_tokens_percentage'
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
                    between 0.1 and 1.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
