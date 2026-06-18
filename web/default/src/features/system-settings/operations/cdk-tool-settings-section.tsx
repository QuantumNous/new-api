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
import { useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { Badge } from '@/components/ui/badge'
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
import { getUser, searchUsers } from '@/features/users/api'
import type { User } from '@/features/users/types'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const cdkToolSchema = z
  .object({
    cdk_tool_setting: z.object({
      enabled: z.boolean(),
      service_user_id: z.coerce.number().int().min(0),
      token_group: z.string(),
      token_name_prefix: z.string().trim().min(1).max(64),
    }),
  })
  .superRefine((values, ctx) => {
    const settings = values.cdk_tool_setting
    if (settings.enabled && settings.service_user_id <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['cdk_tool_setting', 'service_user_id'],
        message: 'Select a service user before enabling CDK Assistant.',
      })
    }
  })

type CdkToolFormInput = z.input<typeof cdkToolSchema>
type CdkToolFormValues = z.output<typeof cdkToolSchema>

type FlatCdkToolSettings = {
  'cdk_tool_setting.enabled': boolean
  'cdk_tool_setting.service_user_id': number
  'cdk_tool_setting.token_group': string
  'cdk_tool_setting.token_name_prefix': string
}

type CdkToolSettingsSectionProps = {
  defaultValues: FlatCdkToolSettings
}

const TOKEN_GROUP_OPTIONS = ['', 'auto', 'default', 'vip', 'svip']

const buildFormDefaults = (
  defaults: FlatCdkToolSettings
): CdkToolFormInput => ({
  cdk_tool_setting: {
    enabled: defaults['cdk_tool_setting.enabled'],
    service_user_id: defaults['cdk_tool_setting.service_user_id'],
    token_group: defaults['cdk_tool_setting.token_group'] ?? '',
    token_name_prefix:
      defaults['cdk_tool_setting.token_name_prefix']?.trim() || 'cdk-tool',
  },
})

const flattenFormValues = (values: CdkToolFormValues): FlatCdkToolSettings => ({
  'cdk_tool_setting.enabled': values.cdk_tool_setting.enabled,
  'cdk_tool_setting.service_user_id': values.cdk_tool_setting.service_user_id,
  'cdk_tool_setting.token_group': values.cdk_tool_setting.token_group.trim(),
  'cdk_tool_setting.token_name_prefix':
    values.cdk_tool_setting.token_name_prefix.trim(),
})

function formatUserLabel(user: User) {
  const displayName = user.display_name?.trim()
  if (displayName && displayName !== user.username) {
    return `${displayName} (${user.username})`
  }
  return user.username
}

function ServiceUserSummary({ user, userId }: { user?: User; userId: number }) {
  const { t } = useTranslation()

  if (userId <= 0) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs'>
        {t('No service user selected')}
      </div>
    )
  }

  if (!user) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs'>
        {t('Selected service user ID: {{id}}', { id: userId })}
      </div>
    )
  }

  return (
    <div className='bg-muted/25 flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2'>
      <div className='flex min-w-0 items-center gap-2'>
        <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-md border'>
          <UserRound className='text-muted-foreground size-4' />
        </div>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>
            {formatUserLabel(user)}
          </div>
          <div className='text-muted-foreground truncate text-xs'>
            ID {user.id} · {t('Group')} {user.group || '-'}
          </div>
        </div>
      </div>
      <Badge
        variant='outline'
        className={cn(
          'shrink-0',
          user.status === 1
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
        )}
      >
        {user.status === 1 ? t('Enabled') : t('Disabled')}
      </Badge>
    </div>
  )
}

type ServiceUserPickerProps = {
  value: number
  onChange: (value: number) => void
}

function ServiceUserPicker({ value, onChange }: ServiceUserPickerProps) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword.trim(), 350)

  const selectedUserQuery = useQuery({
    queryKey: ['cdk-tool-service-user', value],
    queryFn: () => getUser(value),
    enabled: value > 0,
    staleTime: 60 * 1000,
  })

  const userSearchQuery = useQuery({
    queryKey: ['cdk-tool-service-user-search', debouncedKeyword],
    queryFn: () =>
      searchUsers({
        keyword: debouncedKeyword,
        status: '1',
        p: 1,
        page_size: 8,
      }),
    enabled: debouncedKeyword.length > 0,
    staleTime: 30 * 1000,
  })

  const selectedUser = selectedUserQuery.data?.data
  const users = userSearchQuery.data?.data?.items ?? []

  return (
    <div className='space-y-3'>
      <ServiceUserSummary user={selectedUser} userId={value} />
      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className='pl-9'
          placeholder={t('Search users by username or email')}
        />
      </div>
      {userSearchQuery.isFetching ? (
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <Loader2 className='size-3.5 animate-spin' />
          {t('Searching users...')}
        </div>
      ) : null}
      {debouncedKeyword && !userSearchQuery.isFetching && users.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs'>
          {t('No matching enabled users found')}
        </div>
      ) : null}
      {users.length > 0 ? (
        <div className='grid gap-2 sm:grid-cols-2'>
          {users.map((user) => (
            <Button
              key={user.id}
              type='button'
              variant='outline'
              className='h-auto justify-between gap-3 rounded-lg px-3 py-2 text-left shadow-none'
              onClick={() => onChange(user.id)}
            >
              <span className='min-w-0'>
                <span className='block truncate text-sm font-medium'>
                  {formatUserLabel(user)}
                </span>
                <span className='text-muted-foreground block truncate text-xs'>
                  ID {user.id} · {t('Group')} {user.group || '-'}
                </span>
              </span>
              <Check
                className={cn(
                  'size-4 shrink-0',
                  value === user.id ? 'opacity-100' : 'opacity-0'
                )}
              />
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CdkToolSettingsSection({
  defaultValues,
}: CdkToolSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<CdkToolFormInput, unknown, CdkToolFormValues>({
    resolver: zodResolver(cdkToolSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (values: CdkToolFormValues) => {
    const normalizedDefaults = flattenFormValues(
      cdkToolSchema.parse(formDefaults)
    )
    const normalizedValues = flattenFormValues(values)

    const orderedKeys: Array<keyof FlatCdkToolSettings> =
      normalizedDefaults['cdk_tool_setting.enabled'] &&
      !normalizedValues['cdk_tool_setting.enabled']
        ? [
            'cdk_tool_setting.enabled',
            'cdk_tool_setting.service_user_id',
            'cdk_tool_setting.token_group',
            'cdk_tool_setting.token_name_prefix',
          ]
        : [
            'cdk_tool_setting.service_user_id',
            'cdk_tool_setting.token_group',
            'cdk_tool_setting.token_name_prefix',
            'cdk_tool_setting.enabled',
          ]

    const updates = orderedKeys.filter(
      (key) => normalizedValues[key] !== normalizedDefaults[key]
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      await updateOption.mutateAsync({
        key,
        value: normalizedValues[key],
      })
    }
  }

  return (
    <SettingsSection
      title={t('CDK Assistant')}
      description={t(
        'Configure the backend account used by the desktop CDK Assistant to redeem codes and create Codex API keys.'
      )}
    >
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='cdk_tool_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable CDK Assistant redemption')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow the desktop assistant to redeem CDKs without user login and create API keys under the selected service user.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='cdk_tool_setting.service_user_id'
            render={({ field }) => {
              const serviceUserId =
                typeof field.value === 'number' && Number.isFinite(field.value)
                  ? field.value
                  : 0

              return (
                <FormItem data-settings-form-span='full'>
                  <FormLabel>{t('Service User')}</FormLabel>
                  <FormControl>
                    <div className='grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]'>
                      <Input
                        type='number'
                        min='0'
                        value={serviceUserId || ''}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === '' ||
                              !Number.isFinite(event.target.valueAsNumber)
                              ? 0
                              : event.target.valueAsNumber
                          )
                        }
                        placeholder={t('User ID')}
                      />
                      <ServiceUserPicker
                        value={serviceUserId}
                        onChange={(nextUserId) => field.onChange(nextUserId)}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Redeemed CDK quota and generated API keys are attached to this enabled user account.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormField
            control={form.control}
            name='cdk_tool_setting.token_group'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Token Group')}</FormLabel>
                <FormControl>
                  <Input
                    list='cdk-tool-token-group-options'
                    placeholder={t('Leave empty to use service user group')}
                    {...field}
                  />
                </FormControl>
                <datalist id='cdk-tool-token-group-options'>
                  {TOKEN_GROUP_OPTIONS.map((option) => (
                    <option
                      key={option || 'empty'}
                      value={option}
                      label={
                        option === ''
                          ? t('Service user group')
                          : option === 'auto'
                            ? t('Auto group')
                            : option
                      }
                    />
                  ))}
                </datalist>
                <FormDescription>
                  {t(
                    'Use empty for the service user group, auto for automatic routing, or enter an existing group ratio name.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cdk_tool_setting.token_name_prefix'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Token Name Prefix')}</FormLabel>
                <FormControl>
                  <Input placeholder='cdk-tool' {...field} />
                </FormControl>
                <FormDescription>
                  {t('Generated API keys are named like {{example}}.', {
                    example: `${field.value || 'cdk-tool'}-123`,
                  })}
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
