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
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useStatus } from '@/shared/hooks/use-status'
import { useAuthStore } from '@/shared/stores/auth-store'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { clearStaleLoginState } from '../lib/login-recovery'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/login' })
  // Normalize the validated (but still user-controlled) search payload once.
  const redirect =
    typeof search?.redirect === 'string' ? search.redirect : undefined
  const registered = search?.registered === '1'
  const { status: rawStatus } = useStatus()
  // A corrupt cached status could be any JSON value; never pass a non-object
  // into the form's optional-field reads.
  const status = rawStatus && typeof rawStatus === 'object' ? rawStatus : null

  useEffect(() => {
    // Belt-and-braces hydration check: a malformed in-memory user should not
    // reach the form even though the route guard normally redirects valid
    // sessions away.
    const { user } = useAuthStore.getState().auth
    if (
      user !== null &&
      (typeof user !== 'object' ||
        !Number.isFinite(user.id) ||
        typeof user.username !== 'string')
    ) {
      clearStaleLoginState()
    }
  }, [])

  useEffect(() => {
    if (!registered) return
    toast.success(t('Account created successfully. Please log in.'))
    // Drop the flag so a manual reload does not repeat the confirmation.
    void navigate({
      to: '/login',
      search: { redirect },
      replace: true,
    })
  }, [registered, redirect, navigate, t])

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-start'>
            {t('Sign in')}
          </h2>
          {!status?.self_use_mode_enabled &&
            status?.register_enabled !== false && (
              <p className='text-muted-foreground text-start text-sm sm:text-base'>
                {t("Don't have an account?")}{' '}
                <Link
                  to='/sign-up'
                  className='hover:text-primary font-medium underline underline-offset-4'
                >
                  {t('Sign up')}
                </Link>
                .
              </p>
            )}
        </div>

        <UserAuthForm redirectTo={redirect} />

        <TermsFooter
          variant='sign-in'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
