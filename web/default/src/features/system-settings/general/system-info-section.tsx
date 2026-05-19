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
import { RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SYSTEM_NAME, normalizeSystemName } from '@/lib/constants'
import { cn } from '@/lib/utils'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const _systemInfoSchema = z.object({
  theme: z.object({
    frontend: z.enum(['default', 'classic']),
  }),
  SystemName: z.string().min(1),
  ServerAddress: z.string().optional(),
  Logo: z.string().url().optional().or(z.literal('')),
  Footer: z.string().optional(),
  About: z.string().optional(),
  HomePageContent: z.string().optional(),
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

const cockpitFieldClassName =
  'border-white/10 bg-slate-950/50 text-slate-100 placeholder:text-slate-500'

const cockpitOutlineButtonClassName = cn(
  'border-white/15 bg-slate-800/70 text-slate-100 shadow-none',
  'hover:border-white/20 hover:bg-white/15 hover:text-slate-50',
  'disabled:opacity-60 disabled:text-slate-300',
  '[&_svg]:text-slate-200'
)

export function SystemInfoSection({ defaultValues }: SystemInfoSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const normalizedDefaults = useMemo<SystemInfoFormValues>(
    () => ({
      theme: {
        frontend:
          defaultValues.theme?.frontend === 'classic' ? 'classic' : 'default',
      },
      SystemName: normalizeSystemName(
        normalizeValue(defaultValues.SystemName)
      ),
      ServerAddress: normalizeValue(defaultValues.ServerAddress),
      Logo: normalizeValue(defaultValues.Logo),
      Footer: normalizeValue(defaultValues.Footer),
      About: normalizeValue(defaultValues.About),
      HomePageContent: normalizeValue(defaultValues.HomePageContent),
      legal: {
        user_agreement: normalizeValue(defaultValues.legal?.user_agreement),
        privacy_policy: normalizeValue(defaultValues.legal?.privacy_policy),
      },
    }),
    [defaultValues]
  )

  const systemInfoSchemaWithI18n = z.object({
    theme: z.object({
      frontend: z.enum(['default', 'classic']),
    }),
    SystemName: z.string().min(1, {
      error: () => t('System name is required'),
    }),
    ServerAddress: z.string().optional(),
    Logo: z.string().url().optional().or(z.literal('')),
    Footer: z.string().optional(),
    About: z.string().optional(),
    HomePageContent: z.string().optional(),
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
          if (key === 'ServerAddress') {
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

      <div className='rounded-2xl border border-violet-500/15 bg-slate-900/40 p-4 shadow-inner shadow-indigo-950/20 backdrop-blur-sm sm:p-6'>
        <SettingsSection
          title={t('Site platform basic information')}
          description={t('Site platform basic information description')}
          titleProps={{ className: 'text-slate-50' }}
          descriptionClassName='text-slate-400'
        >
        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className='space-y-6 [&_label]:text-slate-200 [&_[data-slot=form-description]]:text-slate-400'
          >
            <FormDirtyIndicator isDirty={isDirty} />
            <FormField
              control={form.control}
              name='theme.frontend'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Frontend Theme')}</FormLabel>
                  <Select
                    items={[
                      { value: 'default', label: t('Default (New Frontend)') },
                      {
                        value: 'classic',
                        label: t('Classic (Legacy Frontend)'),
                      },
                    ]}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={cn('w-full', cockpitFieldClassName)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='default'>
                          {t('Default (New Frontend)')}
                        </SelectItem>
                        <SelectItem value='classic'>
                          {t('Classic (Legacy Frontend)')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Switch between the new frontend and the classic frontend. Changes take effect after page reload.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='SystemName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('System Name')}</FormLabel>
                  <FormControl>
                    <Input
                      className={cockpitFieldClassName}
                      placeholder={DEFAULT_SYSTEM_NAME}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={normalizeSystemName(field.value)}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
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
                    <Input
                      className={cockpitFieldClassName}
                      placeholder='https://yourdomain.com'
                      {...field}
                    />
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
              name='Logo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Logo URL')}</FormLabel>
                  <FormControl>
                    <Input
                      className={cockpitFieldClassName}
                      placeholder={t('https://example.com/logo.png')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('URL to your logo image (optional)')}
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
                      className={cockpitFieldClassName}
                      placeholder={t(
                        '© 2025 Your Company. All rights reserved.'
                      )}
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
                      className={cockpitFieldClassName}
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

            <FormField
              control={form.control}
              name='HomePageContent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Home Page Content')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t(
                        'Welcome to Yunhe Xingze Token Operations Center...'
                      )}
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

            <FormField
              control={form.control}
              name='legal.user_agreement'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('User Agreement')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
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
                      className={cockpitFieldClassName}
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

            <div className='flex gap-2'>
              <Button
                type='submit'
                disabled={isSubmitting || updateOption.isPending}
              >
                {updateOption.isPending ? t('Saving...') : t('Save Changes')}
              </Button>
              <Button
                type='button'
                variant='outline'
                className={cockpitOutlineButtonClassName}
                onClick={handleReset}
                disabled={!isDirty || updateOption.isPending || isSubmitting}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                {t('Reset')}
              </Button>
            </div>
          </form>
        </Form>
        </SettingsSection>
      </div>
    </>
  )
}
