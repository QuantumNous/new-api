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
import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { type Resolver, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { generateAITranslations, updateAITranslationSettings } from '../api'
import { SettingsSection } from '../components/settings-section'
import type { SiteSettings } from '../types'

const schema = z.object({
  AITranslationEnabled: z.boolean(),
  AITranslationBaseURL: z.string().url(),
  AITranslationAPIKey: z.string().optional(),
  AITranslationModel: z.string().min(1),
  AITranslationTimeoutSeconds: z.coerce.number().int().min(1),
})

type FormValues = z.infer<typeof schema>

type Props = {
  defaultValues: Pick<
    SiteSettings,
    | 'AITranslationEnabled'
    | 'AITranslationBaseURL'
    | 'AITranslationAPIKey'
    | 'AITranslationModel'
    | 'AITranslationTimeoutSeconds'
  >
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1'
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeValues(values: Props['defaultValues']): FormValues {
  return {
    AITranslationEnabled: toBool(values.AITranslationEnabled),
    AITranslationBaseURL:
      values.AITranslationBaseURL || 'https://api.openai.com/v1',
    AITranslationAPIKey: values.AITranslationAPIKey || '',
    AITranslationModel: values.AITranslationModel || 'gpt-4o-mini',
    AITranslationTimeoutSeconds: toNumber(
      values.AITranslationTimeoutSeconds,
      30
    ),
  }
}

export function AITranslationSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const normalizedDefaults = normalizeValues(defaultValues)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: normalizedDefaults,
  })

  useEffect(() => {
    form.reset(normalizeValues(defaultValues))
  }, [defaultValues, form])

  const settingsMutation = useMutation({
    mutationFn: updateAITranslationSettings,
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to update setting'))
        return
      }
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      toast.success(t('Setting updated successfully'))
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to update setting'))
    },
  })

  const onSubmit = async (values: FormValues) => {
    await settingsMutation.mutateAsync({
      enabled: values.AITranslationEnabled,
      base_url: values.AITranslationBaseURL.trim(),
      api_key: values.AITranslationAPIKey?.trim() || undefined,
      model: values.AITranslationModel.trim(),
      timeout_seconds: values.AITranslationTimeoutSeconds,
    })
  }

  const generateMutation = useMutation({
    mutationFn: generateAITranslations,
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to generate translations'))
        return
      }
      queryClient.invalidateQueries({ queryKey: ['status'] })
      toast.success(
        t('Translations generated: {{count}} source texts', {
          count: data.data?.stats.source_text_count ?? 0,
        })
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to generate translations'))
    },
  })

  return (
    <SettingsSection
      title={t('AI automatic translation')}
      description={t(
        'Store selected public API response translations in the database and reuse them at request time.'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='AITranslationEnabled'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Enable AI translation')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Only the configured public display fields are translated.'
                    )}
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

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='AITranslationBaseURL'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Translation API base URL')}</FormLabel>
                  <FormControl>
                    <Input placeholder='https://api.openai.com/v1' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='AITranslationModel'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Translation model')}</FormLabel>
                  <FormControl>
                    <Input placeholder='gpt-4o-mini' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='AITranslationAPIKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Translation API key')}</FormLabel>
                <FormControl>
                  <Input autoComplete='off' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='AITranslationTimeoutSeconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Translation timeout seconds')}</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='flex flex-wrap gap-3'>
            <Button type='submit' disabled={settingsMutation.isPending}>
              {settingsMutation.isPending ? t('Saving...') : t('Save settings')}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending
                ? t('Generating translations...')
                : t('Generate translations now')}
            </Button>
          </div>
        </form>
      </Form>
    </SettingsSection>
  )
}
