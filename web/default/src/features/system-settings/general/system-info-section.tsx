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
import { isAiocNavHidden } from '@/config/aioc-demo-visibility'
import { normalizeSystemName } from '@/lib/constants'
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
  'border border-white/15 bg-slate-950/50 text-slate-100 placeholder:text-slate-400'

const cockpitOutlineButtonClassName = cn(
  'border-white/15 bg-slate-800/70 text-slate-100 shadow-none',
  'hover:border-white/20 hover:bg-white/15 hover:text-slate-50',
  'disabled:opacity-60 disabled:text-slate-300',
  '[&_svg]:text-slate-200'
)

const cockpitPrimaryButtonClassName = cn(
  'border-cyan-500/60 bg-cyan-600 text-white shadow-sm',
  'hover:border-cyan-400/70 hover:bg-cyan-500',
  'disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-400'
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
      error: () => t('systemSettings.site.systemName.required'),
    }),
    ServerAddress: z.string().optional(),
    Logo: z.union([
      z.literal(''),
      z.string().url({
        error: () => t('systemSettings.site.logo.invalidUrl'),
      }),
    ]),
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

      <div className='relative z-0 rounded-2xl border border-violet-500/15 bg-slate-900/40 p-4 sm:p-6'>
        <SettingsSection
          title={t('systemSettings.site.pageTitle')}
          description={t('systemSettings.site.pageDescription')}
          titleProps={{ className: 'text-slate-50' }}
          descriptionClassName='text-slate-400'
        >
        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            className='relative z-0 space-y-6 [&_label]:text-slate-100 [&_[data-slot=form-description]]:text-slate-300 [&_[data-slot=form-message]]:text-rose-300'
          >
            <FormDirtyIndicator
              isDirty={isDirty}
              tone='cockpit'
              message={t('systemSettings.site.unsavedChanges')}
            />
            <FormField
              control={form.control}
              name='theme.frontend'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('systemSettings.site.frontendMode.label')}
                  </FormLabel>
                  <Select
                    items={[
                      {
                        value: 'default',
                        label: t(
                          'systemSettings.site.frontendMode.optionDefault'
                        ),
                      },
                      ...(!isAiocNavHidden('classic-frontend')
                        ? [
                            {
                              value: 'classic' as const,
                              label: t(
                                'systemSettings.site.frontendMode.optionClassic'
                              ),
                            },
                          ]
                        : []),
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
                          {t('systemSettings.site.frontendMode.optionDefault')}
                        </SelectItem>
                        {!isAiocNavHidden('classic-frontend') ? (
                          <SelectItem value='classic'>
                            {t(
                              'systemSettings.site.frontendMode.optionClassic'
                            )}
                          </SelectItem>
                        ) : null}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('systemSettings.site.frontendMode.description')}
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
                  <FormLabel>
                    {t('systemSettings.site.systemName.label')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={cockpitFieldClassName}
                      placeholder={t(
                        'systemSettings.site.systemName.placeholder'
                      )}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={normalizeSystemName(field.value)}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.systemName.description')}
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
                  <FormLabel>
                    {t('systemSettings.site.serverAddress.label')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={cockpitFieldClassName}
                      placeholder={t(
                        'systemSettings.site.serverAddress.placeholder'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.serverAddress.description')}
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
                  <FormLabel>{t('systemSettings.site.logo.label')}</FormLabel>
                  <FormControl>
                    <Input
                      className={cockpitFieldClassName}
                      placeholder={t('systemSettings.site.logo.placeholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.logo.description')}
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
                  <FormLabel>{t('systemSettings.site.footer.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t('systemSettings.site.footer.placeholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.footer.description')}
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
                  <FormLabel>{t('systemSettings.site.about.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t('systemSettings.site.about.placeholder')}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.about.description')}
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
                  <FormLabel>
                    {t('systemSettings.site.homeContent.label')}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t('systemSettings.site.homeContent.placeholder')}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.homeContent.description')}
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
                  <FormLabel>
                    {t('systemSettings.site.userAgreement.label')}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t(
                        'systemSettings.site.userAgreement.placeholder'
                      )}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.userAgreement.description')}
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
                  <FormLabel>
                    {t('systemSettings.site.privacyPolicy.label')}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className={cockpitFieldClassName}
                      placeholder={t(
                        'systemSettings.site.privacyPolicy.placeholder'
                      )}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('systemSettings.site.privacyPolicy.description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex gap-2'>
              <Button
                type='submit'
                className={cockpitPrimaryButtonClassName}
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
