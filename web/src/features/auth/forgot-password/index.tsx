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
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  const { t } = useTranslation()
  const { mode } = useSearch({ from: '/(auth)/forgot-password' })
  const isAPIKeyMode = mode === 'api-key'
  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-3'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {isAPIKeyMode ? t('Forgot API Key') : t('Forgot password')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t(
              isAPIKeyMode
                ? 'Enter your registered email and we will send you a link to reset your API Key.'
                : 'Enter your registered email and we will send you a link to reset your password.'
            )}
          </p>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t("Don't have an account?")}{' '}
            <Link
              to='/sign-up'
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              {t('Sign up')}
            </Link>
            .
          </p>
        </div>

        <ForgotPasswordForm
          className='space-y-0'
          mode={isAPIKeyMode ? 'api-key' : 'password'}
        />
      </div>
    </AuthLayout>
  )
}
