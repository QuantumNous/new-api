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
import { Upload, X } from 'lucide-react'
import * as React from 'react'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

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
import { Textarea } from '@/components/ui/textarea'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { isValidTaskPublicAddress } from './task-public-address'

const _systemInfoSchema = z.object({
  SystemName: z.string().min(1),
  ServerAddress: z.string().optional(),
  TaskPublicAddress: z.string().refine(isValidTaskPublicAddress),
  Logo: z.string().url().optional().or(z.literal('')),
  Footer: z.string().optional(),
  About: z.string().optional(),
  HomePageContent: z.string().optional(),
  general_setting: z.object({
    docs_link: z.string(),
  }),
  legal: z.object({
    user_agreement: z.string().optional(),
    privacy_policy: z.string().optional(),
  }),
})

type SystemInfoFormValues = z.infer<typeof _systemInfoSchema>

type SystemInfoSectionProps = {
  defaultValues: SystemInfoFormValues
}

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

export function SystemInfoSection({ defaultValues }: SystemInfoSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const normalizedDefaults: SystemInfoFormValues = {
    SystemName: normalizeValue(defaultValues.SystemName),
    ServerAddress: normalizeValue(defaultValues.ServerAddress),
    TaskPublicAddress: normalizeValue(defaultValues.TaskPublicAddress),
    Logo: normalizeValue(defaultValues.Logo),
    Footer: normalizeValue(defaultValues.Footer),
    About: normalizeValue(defaultValues.About),
    HomePageContent: normalizeValue(defaultValues.HomePageContent),
    general_setting: {
      docs_link: normalizeValue(defaultValues.general_setting?.docs_link),
    },
    legal: {
      user_agreement: normalizeValue(defaultValues.legal?.user_agreement),
      privacy_policy: normalizeValue(defaultValues.legal?.privacy_policy),
    },
  }

  const systemInfoSchemaWithI18n = z.object({
    SystemName: z.string().min(1, {
      error: () => t('System name is required'),
    }),
    ServerAddress: z.string().optional(),
    TaskPublicAddress: z.string().refine(isValidTaskPublicAddress, {
      error: () =>
        t(
          'Enter an absolute HTTP(S) URL without credentials, query parameters, or fragments'
        ),
    }),
    Logo: z.string().url().optional().or(z.literal('')),
    Footer: z.string().optional(),
    About: z.string().optional(),
    HomePageContent: z.string().optional(),
    general_setting: z.object({
      docs_link: z.string(),
    }),
    legal: z.object({
      user_agreement: z.string().optional(),
      privacy_policy: z.string().optional(),
    }),
  })

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<SystemInfoFormValues>({
      resolver: zodResolver(systemInfoSchemaWithI18n) as Resolver<
        SystemInfoFormValues,
        unknown,
        SystemInfoFormValues
      >,
      defaultValues: normalizedDefaults,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          let v = normalizeValue(value)
          if (key === 'ServerAddress' || key === 'TaskPublicAddress') {
            v = v.replace(/\/+$/, '')
          }
          await updateOption.mutateAsync({
            key,
            value: v,
          })
        }
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('System Information')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting || updateOption.isPending}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            <SettingsFormGrid>
              <FormField
                control={form.control}
                name='SystemName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('System Name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('New API')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('The name displayed across the application')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='ServerAddress'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Server Address')}</FormLabel>
                    <FormControl>
                      <Input placeholder='https://yourdomain.com' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The public URL of your server, used for OAuth callbacks, webhooks, and other external integrations'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='TaskPublicAddress'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Async Task Public Address')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://media.example.com/tasks'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Public base URL for async task media. Supports a dedicated media domain, port, or Nginx path prefix; falls back to Server Address when empty.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='Logo'
                render={({ field }) => {
                  // Get showUrlInput state from LogoUploadField
                  // We'll use form state or a separate state manager
                  const [showUrlInput, setShowUrlInput] = React.useState(false)
                  const fileInputRef = React.useRef<HTMLInputElement | null>(
                    null
                  )
                  const { t } = useTranslation()

                  const handleFileChange = (
                    event: React.ChangeEvent<HTMLInputElement>
                  ) => {
                    const file = event.target.files?.[0]
                    if (!file) return

                    if (file.type !== 'image/png') {
                      toast.error(t('Only PNG files are allowed'))
                      event.target.value = ''
                      return
                    }

                    const maxSize = 100 * 1024
                    if (file.size > maxSize) {
                      toast.error(t('File size must be 100KB or smaller'))
                      event.target.value = ''
                      return
                    }

                    const reader = new FileReader()
                    reader.onload = (loadEvent) => {
                      const dataUrl = loadEvent.target?.result as string
                      const img = new Image()
                      img.onload = () => {
                        if (img.width > 128 || img.height > 128) {
                          toast.error(
                            t(
                              'Image dimensions must be {{width}}x{{height}} or smaller',
                              {
                                width: 128,
                                height: 128,
                              }
                            )
                          )
                          event.target.value = ''
                          return
                        }
                        field.onChange(dataUrl)
                        toast.success(t('Logo uploaded successfully'))
                      }
                      img.src = dataUrl
                    }
                    reader.readAsDataURL(file)
                    event.target.value = ''
                  }

                  return (
                    <FormItem>
                      <FormLabel>{t('Logo')}</FormLabel>
                      <div className='flex flex-wrap items-center gap-4'>
                        <input
                          ref={fileInputRef}
                          type='file'
                          accept='image/png'
                          className='hidden'
                          onChange={handleFileChange}
                        />
                        {field.value ? (
                          <button
                            type='button'
                            onClick={() => fileInputRef.current?.click()}
                            className='bg-muted hover:bg-accent flex h-16 w-16 items-center justify-center rounded-lg border p-2 transition-colors'
                          >
                            <img
                              src={field.value}
                              alt={t('Logo preview')}
                              className='h-full w-full object-contain'
                            />
                          </button>
                        ) : (
                          <button
                            type='button'
                            onClick={() => fileInputRef.current?.click()}
                            className='bg-muted text-muted-foreground hover:bg-accent flex h-16 w-16 flex-col items-center justify-center rounded-lg border text-xs transition-colors'
                          >
                            <Upload className='mb-1 h-5 w-5' />
                            {t('Click to upload')}
                          </button>
                        )}
                        <div className='flex gap-2'>
                          {!showUrlInput && (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() => setShowUrlInput(true)}
                            >
                              {t('Enter URL')}
                            </Button>
                          )}
                          {field.value ? (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() => field.onChange('')}
                            >
                              <X className='mr-2 h-4 w-4' />
                              {t('Clear')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <FormDescription>
                        {t(
                          'Upload a PNG image (max 128×128 pixels, 100KB). Alternatively, enter a URL.'
                        )}
                      </FormDescription>
                      {showUrlInput && (
                        <FormControl>
                          <div className='relative mt-2'>
                            <Input
                              placeholder={t('https://example.com/logo.png')}
                              value={
                                field.value?.startsWith('data:')
                                  ? ''
                                  : field.value || ''
                              }
                              onChange={(e) => {
                                if (!e.target.value.startsWith('data:')) {
                                  field.onChange(e.target.value)
                                }
                              }}
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='absolute top-1/2 right-1 h-7 -translate-y-1/2'
                              onClick={() => setShowUrlInput(false)}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </div>
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <FormField
                control={form.control}
                name='general_setting.docs_link'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Documentation Link')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('https://docs.example.com')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Link to your documentation site')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='Footer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Footer')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          '© 2025 Your Company. All rights reserved.'
                        )}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Footer text displayed at the bottom of pages')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='About'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('About')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Enter HTML code (e.g., <p>About us...</p>) or a URL (e.g., https://example.com) to embed as iframe'
                        )}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Supports HTML markup or iframe embedding. Enter HTML code directly, or provide a complete URL to automatically embed it as an iframe.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SettingsFormGridItem span='full'>
                <FormField
                  control={form.control}
                  name='HomePageContent'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Home Page Content')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('Welcome to our New API...')}
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Content displayed on the home page (supports Markdown)'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SettingsFormGridItem>

              <FormField
                control={form.control}
                name='legal.user_agreement'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('User Agreement')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Provide Markdown, HTML, or an external URL for the user agreement'
                        )}
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Leave empty to disable the agreement requirement. Supports Markdown, HTML, or a full URL to redirect users.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='legal.privacy_policy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Privacy Policy')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Provide Markdown, HTML, or an external URL for the privacy policy'
                        )}
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Leave empty to disable the privacy policy requirement. Supports Markdown, HTML, or a full URL to redirect users.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsFormGrid>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
