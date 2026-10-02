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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { PermissionMatrix } from '@/components/permission-matrix'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { permissionMatrixToScopes } from '@/lib/admin-permissions'

import type { AccessTokenCatalog, AccessTokenInput } from '../../api'
import { accessTokenPermissionGroups } from '../../lib/access-token-catalog'
import {
  ACCESS_TOKEN_EXPIRY_OPTIONS,
  accessTokenFormSchema,
  defaultAccessTokenFormValues,
  resolveAccessTokenExpiry,
  type AccessTokenExpiryPreset,
  type AccessTokenFormValues,
} from '../../lib/access-token-schema'

type AccessTokenCreateDialogProps = {
  open: boolean
  // Hides the dialog while security verification is showing, keeping the form.
  hidden: boolean
  catalog: AccessTokenCatalog
  pending: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: AccessTokenInput) => Promise<boolean>
}

export function AccessTokenCreateDialog(props: AccessTokenCreateDialogProps) {
  const { t } = useTranslation()
  const form = useForm<AccessTokenFormValues>({
    resolver: zodResolver(accessTokenFormSchema),
    defaultValues: defaultAccessTokenFormValues,
  })
  const expiry = form.watch('expiry')
  const groups = accessTokenPermissionGroups(props.catalog)

  const close = () => {
    if (props.pending) return
    form.reset(defaultAccessTokenFormValues)
    props.onOpenChange(false)
  }
  const submit = async (values: AccessTokenFormValues) => {
    const created = await props.onCreate({
      name: values.name.trim(),
      scopes: permissionMatrixToScopes(values.permissions),
      expires_at: resolveAccessTokenExpiry(values, Date.now()),
    })
    if (!created) return
    form.reset(defaultAccessTokenFormValues)
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open && !props.hidden}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={t('Create access token')}
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={props.pending}
            onClick={close}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='access-token-create-form'
            disabled={props.pending}
          >
            {t('Create access token')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='access-token-create-form'
          className='space-y-5 py-2'
          onSubmit={form.handleSubmit(submit)}
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Token name')}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='expiry'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Expiration')}</FormLabel>
                <ToggleGroup
                  value={[field.value]}
                  onValueChange={(values) => {
                    const next = values.find((value) => value !== field.value)
                    if (next) field.onChange(next as AccessTokenExpiryPreset)
                  }}
                  aria-label={t('Expiration')}
                  variant='outline'
                  spacing={2}
                  className='grid w-full grid-cols-3 gap-2 sm:grid-cols-6'
                >
                  {ACCESS_TOKEN_EXPIRY_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className='w-full'
                    >
                      {t(option.labelKey)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {expiry === 'never' && (
                  <p className='text-warning text-xs'>
                    {t(
                      'A token that never expires stays valid until you revoke it. Set an expiration date when possible.'
                    )}
                  </p>
                )}
              </FormItem>
            )}
          />
          {expiry === 'custom' && (
            <FormField
              control={form.control}
              name='customExpiresAt'
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DateTimePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name='permissions'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Permissions')}</FormLabel>
                <PermissionMatrix
                  groups={groups}
                  value={field.value}
                  disabled={props.pending}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
