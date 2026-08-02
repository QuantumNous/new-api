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
import { ShieldCheck } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { PasswordInput } from '@/components/password-input'
import {
  PasswordConfirmationStatus,
  PasswordStrength,
} from '@/components/password-strength'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import type { SetupFormValues } from '../types'

interface AdminStepProps {
  form: UseFormReturn<SetupFormValues>
  rootInitialized?: boolean
}

export function AdminStep({ form, rootInitialized }: AdminStepProps) {
  const { t } = useTranslation()
  const passwordValue = useWatch({ control: form.control, name: 'password' })
  const confirmationValue = useWatch({
    control: form.control,
    name: 'confirmPassword',
  })

  if (rootInitialized) {
    return (
      <Alert className='border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/40'>
        <AlertDescription className='flex items-start gap-2'>
          <ShieldCheck className='mt-0.5 size-4 text-sky-500' />
          {t(
            'The administrator account is already initialized. You can keep your existing credentials and continue to the next step.'
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <FormField
        control={form.control}
        name='username'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Administrator username')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t('Choose a username')}
                autoComplete='username'
                onChange={(event) => {
                  form.clearErrors('username')
                  field.onChange(event)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='password'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Password')}</FormLabel>
            <FormControl>
              <PasswordInput
                {...field}
                placeholder={t('Enter password (8-20 characters)')}
                autoComplete='new-password'
                minLength={8}
                maxLength={20}
                aria-describedby='setup-admin-password-strength'
                onChange={(event) => {
                  form.clearErrors('password')
                  field.onChange(event)
                }}
              />
            </FormControl>
            <PasswordStrength
              id='setup-admin-password-strength'
              value={passwordValue}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='confirmPassword'
        render={({ field }) => (
          <FormItem className='sm:col-span-2'>
            <FormLabel>{t('Confirm password')}</FormLabel>
            <FormControl>
              <PasswordInput
                {...field}
                placeholder={t('Repeat the administrator password')}
                autoComplete='new-password'
                minLength={8}
                maxLength={20}
                aria-describedby={
                  confirmationValue
                    ? 'setup-admin-password-confirmation-status'
                    : undefined
                }
                onChange={(event) => {
                  form.clearErrors('confirmPassword')
                  field.onChange(event)
                }}
              />
            </FormControl>
            <PasswordConfirmationStatus
              id='setup-admin-password-confirmation-status'
              password={passwordValue}
              confirmation={confirmationValue}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
