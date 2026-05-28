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
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateProvider,
  useUpdateProvider,
} from '../hooks/use-custom-oauth-mutations'
import {
  customOAuthFormSchema,
  AUTH_STYLE_OPTIONS,
  type CustomOAuthProvider,
  type CustomOAuthFormValues,
} from '../types'
import { DiscoveryButton } from './discovery-button'
import { PresetSelector } from './preset-selector'

type ProviderFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: CustomOAuthProvider | null
}

export function ProviderFormDialog(props: ProviderFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!props.provider
  const createProvider = useCreateProvider()
  const updateProvider = useUpdateProvider()

  const form = useForm<CustomOAuthFormValues>({
    resolver: zodResolver(
      customOAuthFormSchema
    ) as unknown as Resolver<CustomOAuthFormValues>,
    defaultValues: {
      name: '',
      slug: '',
      icon: '',
      enabled: true,
      client_id: '',
      client_secret: '',
      authorization_endpoint: '',
      token_endpoint: '',
      user_info_endpoint: '',
      scopes: '',
      user_id_field: '',
      username_field: '',
      display_name_field: '',
      email_field: '',
      well_known: '',
      auth_style: 0,
      access_policy: '',
      access_denied_message: '',
    },
  })

  useEffect(() => {
    if (props.open && props.provider) {
      form.reset({
        name: props.provider.name,
        slug: props.provider.slug,
        icon: props.provider.icon || '',
        enabled: props.provider.enabled,
        client_id: props.provider.client_id,
        client_secret: props.provider.client_secret || '',
        authorization_endpoint: props.provider.authorization_endpoint,
        token_endpoint: props.provider.token_endpoint,
        user_info_endpoint: props.provider.user_info_endpoint,
        scopes: props.provider.scopes || '',
        user_id_field: props.provider.user_id_field,
        username_field: props.provider.username_field || '',
        display_name_field: props.provider.display_name_field || '',
        email_field: props.provider.email_field || '',
        well_known: props.provider.well_known || '',
        auth_style: props.provider.auth_style ?? 0,
        access_policy: props.provider.access_policy || '',
        access_denied_message: props.provider.access_denied_message || '',
      })
    } else if (props.open && !props.provider) {
      form.reset({
        name: '',
        slug: '',
        icon: '',
        enabled: true,
        client_id: '',
        client_secret: '',
        authorization_endpoint: '',
        token_endpoint: '',
        user_info_endpoint: '',
        scopes: '',
        user_id_field: '',
        username_field: '',
        display_name_field: '',
        email_field: '',
        well_known: '',
        auth_style: 0,
        access_policy: '',
        access_denied_message: '',
      })
    }
  }, [props.open, props.provider, form])

  const onSubmit = async (values: CustomOAuthFormValues) => {
    if (isEditing && props.provider) {
      const res = await updateProvider.mutateAsync({
        id: props.provider.id,
        data: values,
      })
      if (res.success) {
        props.onOpenChange(false)
      }
    } else {
      const res = await createProvider.mutateAsync(
        values as Omit<CustomOAuthProvider, 'id'>
      )
      if (res.success) {
        props.onOpenChange(false)
      }
    }
  }

  const isPending = createProvider.isPending || updateProvider.isPending

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('Edit OAuth Provider') : t('Add OAuth Provider')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('Update the configuration for this custom OAuth provider.')
              : t(
                  'Configure a new custom OAuth provider for user authentication.'
                )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* Preset Selector (only for creating) */}
            {!isEditing && <PresetSelector form={form} />}

            {/* Basic Info */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium'>{t('Basic Info')}</h4>

              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        {t('Enabled')}
                      </FormLabel>
                      <FormDescription>
                        {t('Allow users to sign in with this provider')}
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

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Provider Name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('e.g. My GitLab')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='slug'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Slug')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('e.g. my-gitlab')} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('Used in URLs and API routes')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='icon'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Icon')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Icon identifier (e.g. github, gitlab)')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional icon identifier for the login button')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Credentials */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium'>{t('Credentials')}</h4>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='client_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('OAuth Client ID')}
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('OAuth Client Secret')}
                          autoComplete='new-password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='auth_style'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Auth Style')}</FormLabel>
                    <Select
                      items={[
                        ...AUTH_STYLE_OPTIONS.map((option) => ({
                          value: String(option.value),
                          label: t(option.labelKey),
                        })),
                      ]}
                      value={String(field.value)}
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {AUTH_STYLE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={String(option.value)}
                            >
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'How client credentials are sent to the token endpoint'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Endpoints */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-medium'>{t('Endpoints')}</h4>
                <DiscoveryButton form={form} />
              </div>

              <FormField
                control={form.control}
                name='well_known'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Well-Known URL')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          'https://provider.com/.well-known/openid-configuration'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'OIDC discovery URL. Click "Auto-discover" to fetch endpoints automatically.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='authorization_endpoint'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Authorization Endpoint')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://provider.com/oauth/authorize'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='token_endpoint'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Token Endpoint')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://provider.com/oauth/token'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='user_info_endpoint'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('User Info Endpoint')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://provider.com/api/user'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='scopes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Scopes')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('e.g. openid profile email')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Space-separated OAuth scopes')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Field Mapping */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium'>{t('Field Mapping')}</h4>
              <FormDescription>
                {t(
                  'Map fields from the user info response to local user attributes. Supports nested paths (e.g. ocs.data.id).'
                )}
              </FormDescription>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='user_id_field'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('User ID Field')}</FormLabel>
                      <FormControl>
                        <Input placeholder='id' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='username_field'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Username Field')}</FormLabel>
                      <FormControl>
                        <Input placeholder='login' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='display_name_field'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Display Name Field')}</FormLabel>
                      <FormControl>
                        <Input placeholder='name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='email_field'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Email Field')}</FormLabel>
                      <FormControl>
                        <Input placeholder='email' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Advanced */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium'>{t('Advanced')}</h4>

              <FormField
                control={form.control}
                name='access_policy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Access Policy (JSON)')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Optional JSON policy to restrict access based on user info fields'
                        )}
                        className='min-h-[80px] font-mono text-xs'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'JSON-based access control rules. Leave empty to allow all users.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='access_denied_message'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Access Denied Message')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          'Custom message shown when access is denied'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={isPending}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending
                  ? t('Saving...')
                  : isEditing
                    ? t('Update Provider')
                    : t('Create Provider')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
