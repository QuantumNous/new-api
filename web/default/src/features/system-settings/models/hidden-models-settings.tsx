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
import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const hiddenModelsSchema = z.object({
  pricing_visibility_setting: z.object({
    hidden_models: z.string(),
  }),
})

type HiddenModelsFormValues = z.infer<typeof hiddenModelsSchema>

type HiddenModelsSettingsProps = {
  defaultValue: string
}

/**
 * "Hidden models" tab of the Model Pricing card. Renders bare content — the
 * surrounding SettingsSection belongs to RatioSettingsCard, same as the
 * sibling tool-prices and upstream-sync tabs.
 */
export function HiddenModelsSettings({
  defaultValue,
}: HiddenModelsSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<HiddenModelsFormValues>({
      resolver: zodResolver(hiddenModelsSchema) as Resolver<
        HiddenModelsFormValues,
        unknown,
        HiddenModelsFormValues
      >,
      defaultValues: {
        pricing_visibility_setting: { hidden_models: defaultValue },
      },
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (typeof value !== 'string') continue
          await updateOption.mutateAsync({ key, value })
        }
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            onReset={handleReset}
            isSaving={updateOption.isPending || isSubmitting}
            isResetDisabled={!isDirty}
          />
          <FormDirtyIndicator isDirty={isDirty} />

          <FormField
            control={form.control}
            name='pricing_visibility_setting.hidden_models'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Hidden models')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder='gpt-4o, claude-*, *-internal'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Comma-separated model names to hide from the pricing pages. Supports * wildcards (prefix, suffix, or contains). Hidden models remain fully callable via the API.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </>
  )
}
