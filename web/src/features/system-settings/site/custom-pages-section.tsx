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
import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useFieldArray, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  customPagesSchema,
  type CustomPagesFormValues,
} from '@/features/custom-pages/lib/schema'
import {
  MAX_CUSTOM_PAGES,
  parseCustomPagesOption,
  serializeCustomPages,
} from '@/lib/custom-pages'

import {
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

export function CustomPagesSection(props: { defaultValue: string }) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaultValues = useMemo(
    () => ({ pages: parseCustomPagesOption(props.defaultValue) }),
    [props.defaultValue]
  )
  const settings = useSettingsForm<CustomPagesFormValues>({
    resolver: zodResolver(customPagesSchema),
    defaultValues,
    onSubmit: async (values) => {
      await updateOption.mutateAsync({
        key: 'CustomPages',
        value: serializeCustomPages(values.pages),
      })
    },
  })
  const fields = useFieldArray({
    control: settings.form.control,
    name: 'pages',
  })
  const pages = useWatch({ control: settings.form.control, name: 'pages' })
  const save = () => {
    void settings.handleSubmit().catch(() => {})
  }

  return (
    <SettingsSection title={t('Embedded pages')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Each entry adds a sidebar menu item that opens the URL inside the console. Pages that refuse to be embedded can be opened in a new tab.'
        )}
      </p>
      <Form {...settings.form}>
        <SettingsForm
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <SettingsPageFormActions
            onSave={save}
            onReset={settings.handleReset}
            isSaving={settings.isSubmitting}
          />
          <fieldset
            className='grid min-w-0 gap-4'
            disabled={settings.isSubmitting}
          >
            <legend className='sr-only'>{t('Embedded pages')}</legend>
            {fields.fields.length === 0 && (
              <EmptyState
                title={t(
                  'No custom pages yet. Add one to show it in the sidebar.'
                )}
              />
            )}
            {fields.fields.map((page, index) => (
              <fieldset
                key={page.id}
                className='grid min-w-0 gap-3 rounded-xl border p-4'
              >
                <legend className='sr-only'>
                  {t('Menu name')} {index + 1}
                </legend>
                <SettingsFormGrid>
                  <FormField
                    control={settings.form.control}
                    name={`pages.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Menu name')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('Status page')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={settings.form.control}
                    name={`pages.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('URL')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='https://status.example.com'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SettingsFormGrid>
                <div className='grid gap-x-5 sm:grid-cols-2'>
                  <FormField
                    control={settings.form.control}
                    name={`pages.${index}.adminOnly`}
                    render={({ field }) => (
                      <SettingsSwitchField
                        controlId={`${page.id}-admin`}
                        label={t('Admins only')}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <FormField
                    control={settings.form.control}
                    name={`pages.${index}.highlight`}
                    render={({ field }) => (
                      <SettingsSwitchField
                        controlId={`${page.id}-highlight`}
                        label={t('Highlight in sidebar')}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <FormField
                  control={settings.form.control}
                  name={`pages.${index}.highlightColor`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Highlight color')}</FormLabel>
                      <FormControl>
                        <NativeSelect
                          {...field}
                          value={field.value ?? ''}
                          disabled={!pages[index]?.highlight}
                          className='w-full sm:w-48'
                        >
                          <NativeSelectOption value=''>
                            {t('Follow theme')}
                          </NativeSelectOption>
                          <NativeSelectOption value='blue'>
                            {t('Blue')}
                          </NativeSelectOption>
                          <NativeSelectOption value='green'>
                            {t('Green')}
                          </NativeSelectOption>
                          <NativeSelectOption value='purple'>
                            {t('Purple')}
                          </NativeSelectOption>
                          <NativeSelectOption value='orange'>
                            {t('Orange')}
                          </NativeSelectOption>
                          <NativeSelectOption value='red'>
                            {t('Red')}
                          </NativeSelectOption>
                        </NativeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-destructive justify-self-end'
                  onClick={() => fields.remove(index)}
                >
                  <Trash2 aria-hidden='true' />
                  {t('Remove page')}
                </Button>
              </fieldset>
            ))}
            <Button
              type='button'
              variant='outline'
              className='justify-self-start'
              disabled={fields.fields.length >= MAX_CUSTOM_PAGES}
              onClick={() =>
                fields.append({
                  name: '',
                  url: '',
                  adminOnly: false,
                  highlight: false,
                })
              }
            >
              <Plus aria-hidden='true' />
              {t('Add page')}
            </Button>
          </fieldset>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Maximum {{count}} pages. Menu names must be unique; the page URL stays on the server for admin-only entries.',
              { count: MAX_CUSTOM_PAGES }
            )}
          </p>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
