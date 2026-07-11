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

import { useStatus } from '@/hooks/use-status'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()
  const { status } = useStatus()

  return (
    <AuthLayout
      title={t('Create an account')}
      description={t('Enter your details below to get started.')}
      footer={
        <div className='space-y-3'>
          <p>
            {t('Already have an account?')}{' '}
            <Link
              to='/sign-in'
              className='text-foreground hover:text-primary font-medium underline underline-offset-4'
            >
              {t('Sign in')}
            </Link>
          </p>
          <TermsFooter variant='sign-up' status={status} />
        </div>
      }
    >
      <SignUpForm />
    </AuthLayout>
  )
}
