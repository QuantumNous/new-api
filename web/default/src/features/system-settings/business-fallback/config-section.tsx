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
import { useEffect, useMemo, useRef } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { formatJsonForEditor, normalizeJsonString } from '../content/utils'
import { useUpdateOption } from '../hooks/use-update-option'

export const DEFAULT_BUSINESS_FALLBACK_CONFIG = `{
  "enabled": true,
  "image_generation": {
    "families": {
      "gpt_image": {
        "match_models": ["gpt-image-2"],
        "select_model": "gpt-image-2"
      },
      "gemini_image": {
        "match_models": ["gemini-3.1-flash-image-preview"],
        "select_model": "gemini-3.1-flash-image-preview"
      },
      "seedream": {
        "match_models": ["doubao-seedream-5-0*"],
        "select_model": "doubao-seedream-5-0"
      }
    },
    "chains": {
      "gpt_image": ["gpt_image", "gemini_image", "seedream"],
      "gemini_image": ["gemini_image", "gpt_image", "seedream"],
      "seedream": ["seedream"]
    },
    "health": {
      "enabled": true,
      "monitored_families": ["gpt_image", "gemini_image"],
      "window_minutes": 60,
      "min_samples": 10,
      "success_rate_threshold": 0.3,
      "block_minutes": 60
    }
  }
}`

type BusinessFallbackConfigSectionProps = {
  value: string
}

type FormValues = {
  config: string
}

const schema = z.object({
  config: z.string().superRefine((value, ctx) => {
    try {
      const parsed = JSON.parse(
        normalizeJsonString(value, DEFAULT_BUSINESS_FALLBACK_CONFIG)
      )
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JSON must be an object',
        })
      }
    } catch (error: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          (error instanceof Error ? error.message : null) ||
          'Invalid JSON data',
      })
    }
  }),
})

export function BusinessFallbackConfigSection(
  props: BusinessFallbackConfigSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formattedValue = useMemo(
    () => formatJsonForEditor(props.value, DEFAULT_BUSINESS_FALLBACK_CONFIG),
    [props.value]
  )
  const initialNormalizedRef = useRef(
    normalizeJsonString(props.value, DEFAULT_BUSINESS_FALLBACK_CONFIG)
  )

  const form = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      config: formattedValue,
    },
  })

  useEffect(() => {
    initialNormalizedRef.current = normalizeJsonString(
      props.value,
      DEFAULT_BUSINESS_FALLBACK_CONFIG
    )
    form.reset({
      config: formatJsonForEditor(
        props.value,
        DEFAULT_BUSINESS_FALLBACK_CONFIG
      ),
    })
  }, [form, props.value])

  const onSubmit = async (values: FormValues) => {
    const normalized = normalizeJsonString(
      values.config,
      DEFAULT_BUSINESS_FALLBACK_CONFIG
    )
    if (normalized === initialNormalizedRef.current) {
      return
    }
    await updateOption.mutateAsync({
      key: 'business_fallback.config',
      value: normalized,
    })
    initialNormalizedRef.current = normalized
    form.reset({
      config: formatJsonForEditor(normalized, DEFAULT_BUSINESS_FALLBACK_CONFIG),
    })
  }

  return (
    <SettingsSection title={t('Business Fallback Configuration')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={!form.formState.isValid || !form.formState.isDirty}
            saveLabel='Save Changes'
          />
          <FormField
            control={form.control}
            name='config'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Configuration JSON')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={28}
                    spellCheck={false}
                    className='min-h-[520px] resize-y font-mono text-xs leading-relaxed'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
