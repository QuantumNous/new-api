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
import { useEffect } from 'react'
import { useStatus } from '@/hooks/use-status'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { ensurePixelsLoaded } from '@/lib/analytics/pixels'
import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()
  const { status } = useStatus()
  // Keep redirect available for alternate sign-up providers and the sign-in cross-link.
  // Password registration ignores it after success because new users go to Playground first-run.
  const { redirect } = useSearch({ from: '/(auth)/sign-up' })

  useEffect(() => {
    ensurePixelsLoaded()
    trackAdsFunnelEvent('flatkey_signup_page_view', {
      path: window.location.pathname,
      lng: new URLSearchParams(window.location.search).get('lng') || undefined,
    })
  }, [])

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Create API key, get free credits')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t('No credit card required.')}
          </p>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t('Already have an account?')}{' '}
            <Link
              to='/sign-in'
              search={redirect ? { redirect } : undefined}
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              {t('Sign in')}
            </Link>
            .
          </p>
        </div>

        <SignUpForm redirectTo={redirect} />

        <TermsFooter status={status} className='text-center' />
      </div>
    </AuthLayout>
  )
}
