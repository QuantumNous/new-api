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
import { useEffect, useRef } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_API_KEY_USAGE_GUIDE_JSON,
  validateApiKeyUsageGuideJson,
} from '@/features/keys/lib/usage-guide-templates'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { formatJsonForEditor, normalizeJsonString } from './utils'

const API_KEY_USAGE_TIPS_OPTION_KEY = 'console_setting.api_key_usage_tips'

const createApiKeyUsageTipsSchema = (t: (key: string) => string) =>
  z.object({
    apiKeyUsageTips: z.string().superRefine((value, ctx) => {
      if (!validateApiKeyUsageGuideJson(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('Invalid API KEY usage tips JSON.'),
        })
      }
    }),
  })

type ApiKeyUsageTipsFormValues = z.infer<
  ReturnType<typeof createApiKeyUsageTipsSchema>
>

type ApiKeyUsageTipsSectionProps = {
  defaultValue: string
}

function formatUsageTipsForEditor(value: string) {
  if (!value.trim()) return DEFAULT_API_KEY_USAGE_GUIDE_JSON
  return formatJsonForEditor(value, DEFAULT_API_KEY_USAGE_GUIDE_JSON)
}

function normalizeUsageTips(value: string) {
  if (!value.trim()) return ''
  return normalizeJsonString(value, DEFAULT_API_KEY_USAGE_GUIDE_JSON)
}

function PlaceholderCode({ children }: { children: string }) {
  return (
    <code className='bg-muted text-foreground rounded px-1 py-0.5 font-mono text-xs'>
      {children}
    </code>
  )
}

export function ApiKeyUsageTipsSection({
  defaultValue,
}: ApiKeyUsageTipsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const schema = createApiKeyUsageTipsSchema(t)
  const form = useForm<ApiKeyUsageTipsFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      apiKeyUsageTips: formatUsageTipsForEditor(defaultValue),
    },
  })
  const initialNormalizedRef = useRef(normalizeUsageTips(defaultValue))

  useEffect(() => {
    form.reset({ apiKeyUsageTips: formatUsageTipsForEditor(defaultValue) })
    initialNormalizedRef.current = normalizeUsageTips(defaultValue)
  }, [defaultValue, form])

  const onSubmit = async (values: ApiKeyUsageTipsFormValues) => {
    const normalized = normalizeUsageTips(values.apiKeyUsageTips)
    if (normalized === initialNormalizedRef.current) {
      return
    }

    await updateOption.mutateAsync({
      key: API_KEY_USAGE_TIPS_OPTION_KEY,
      value: normalized,
    })
    initialNormalizedRef.current = normalized
  }

  const handleReset = () => {
    form.setValue('apiKeyUsageTips', DEFAULT_API_KEY_USAGE_GUIDE_JSON, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  const handleSave = () => {
    void form.handleSubmit(onSubmit)()
  }

  return (
    <SettingsSection title={t('API KEY Usage Tips')}>
      <Form {...form}>
        {/* eslint-disable-next-line react-hooks/refs */}
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={handleSave}
            onReset={handleReset}
            isSaving={updateOption.isPending}
            saveLabel='Save API KEY usage tips'
            resetLabel='Reset to default template'
          />
          <FormField
            control={form.control}
            name='apiKeyUsageTips'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API KEY usage tips JSON')}</FormLabel>
                <FormControl>
                  <Textarea rows={24} spellCheck={false} {...field} />
                </FormControl>
                <FormDescription className='space-y-1'>
                  <span className='block'>
                    {t(
                      'Configure the usage tips shown from the API key row menu.'
                    )}
                  </span>
                  <span className='block'>
                    {t(
                      'Each section can contain multiple files, such as config.toml and auth.json.'
                    )}
                  </span>
                  <span className='flex flex-wrap items-center gap-1.5'>
                    <span>{t('Supports placeholders:')}</span>
                    <PlaceholderCode>{'{{apiKey}}'}</PlaceholderCode>
                    <PlaceholderCode>{'{{apiKeyWithoutPrefix}}'}</PlaceholderCode>
                    <PlaceholderCode>{'{{baseUrl}}'}</PlaceholderCode>
                    <PlaceholderCode>{'{{baseUrlV1}}'}</PlaceholderCode>
                    <PlaceholderCode>{'{{keyName}}'}</PlaceholderCode>
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
