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
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

import { AuthLayout } from '../auth-layout'

export type ResetPasswordSearchParams = {
  email?: string
  token?: string
}

type ResetPasswordConfirmProps = ResetPasswordSearchParams

export function ResetPasswordConfirm({
  email,
  token,
}: ResetPasswordConfirmProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFACode, setTwoFACode] = useState('')
  const [needsTwoFA, setNeedsTwoFA] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const isValidResetLink = Boolean(email && token)

  async function handleSubmit() {
    if (!isValidResetLink || !email || !token) {
      toast.error(t('Invalid reset link, please request a new password reset'))
      return
    }
    if (password !== confirmPassword) {
      toast.error(t('Passwords do not match'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post(
        '/api/user/reset',
        {
          email,
          token,
          password,
          ...(twoFACode ? { two_fa_code: twoFACode } : {}),
        },
        { skipBusinessError: true } as Record<string, unknown>
      )

      if (res?.data?.success) {
        setDone(true)
        toast.success(t('auth.resetPasswordConfirm.success'))
      } else {
        if (res?.data?.code === 'TWO_FA_REQUIRED') setNeedsTwoFA(true)
        handleServerError(createServerError(res.data, t('Request failed')))
      }
    } catch (error) {
      const code = (error as { response?: { data?: { code?: string } } })
        ?.response?.data?.code
      if (code === 'TWO_FA_REQUIRED') setNeedsTwoFA(true)
      handleServerError(AuthOperationError.from(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Reset password')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {done
              ? t('auth.resetPasswordConfirm.success')
              : t('Choose a new password for your account.')}
          </p>
        </div>

        <div className='space-y-4'>
          {!isValidResetLink && (
            <Alert variant='destructive'>
              <AlertDescription>
                {t('Invalid reset link, please request a new password reset.')}
              </AlertDescription>
            </Alert>
          )}

          <div className='space-y-2'>
            <Label htmlFor='email'>{t('Email')}</Label>
            <Input
              id='email'
              type='email'
              value={email || ''}
              disabled
              placeholder={t('Waiting for email...')}
            />
          </div>

          {!done && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='password'>{t('New password')}</Label>
                <Input
                  id='password'
                  type='password'
                  autoComplete='new-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='confirm-password'>
                  {t('Confirm new password')}
                </Label>
                <Input
                  id='confirm-password'
                  type='password'
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {needsTwoFA && (
                <div className='space-y-2'>
                  <Label htmlFor='two-fa-code'>
                    {t('Two-factor authentication code')}
                  </Label>
                  <Input
                    id='two-fa-code'
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <Button
            className='w-full'
            onClick={
              done
                ? () => navigate({ to: '/sign-in', replace: true })
                : handleSubmit
            }
            disabled={
              done
                ? false
                : loading || !isValidResetLink || !password || !confirmPassword
            }
          >
            {done
              ? t('auth.resetPasswordConfirm.backToLogin')
              : t('auth.resetPasswordConfirm.confirm')}
          </Button>

          {!done && (
            <Button
              variant='link'
              className='w-full'
              onClick={() => navigate({ to: '/sign-in', replace: true })}
            >
              {t('Back to login')}
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
