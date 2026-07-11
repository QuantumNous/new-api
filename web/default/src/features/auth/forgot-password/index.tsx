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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  const { t } = useTranslation()

  return (
    <AuthLayout
      title={t('Forgot password')}
      description={t(
        'Enter your registered email and we will send you a link to reset your password.'
      )}
      footer={
        <p>
          {t('Remember your password?')}{' '}
          <Link
            to='/sign-in'
            className='text-foreground hover:text-primary font-medium underline underline-offset-4'
          >
            {t('Sign in')}
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
