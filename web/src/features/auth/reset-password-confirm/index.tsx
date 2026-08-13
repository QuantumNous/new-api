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
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Turnstile } from '@/components/turnstile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useCountdown } from '@/hooks/use-countdown'
import { api, clearAuthentication } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { AuthLayout } from '../auth-layout'

export type ResetPasswordSearchParams = {
  email?: string
  token?: string
  mode?: 'api-key' | 'password'
}

type ResetPasswordConfirmProps = ResetPasswordSearchParams

export function ResetPasswordConfirm({
  email,
  token,
  mode = 'password',
}: ResetPasswordConfirmProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [newCredential, setNewCredential] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: 30 })
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()

  const isValidResetLink = Boolean(email && token)

  async function handleSubmit() {
    if (!isValidResetLink || !email || !token) {
      toast.error(
        t(
          mode === 'api-key'
            ? 'Invalid reset link, please request a new API Key reset'
            : 'Invalid reset link, please request a new password reset'
        )
      )
      return
    }

    if (mode === 'api-key' && !validateTurnstile()) return

    startCountdown()
    setLoading(true)
    try {
      const isAPIKeyReset = mode === 'api-key'
      const res = await api.post(
        isAPIKeyReset ? '/api/user/reset-api-key' : '/api/user/reset',
        { email, token, turnstile: isAPIKeyReset ? turnstileToken : undefined },
        {
          skipBusinessError: true,
        }
      )

      if (res?.data?.success) {
        const credential = res.data.data?.full_key ?? res.data.data
        if (typeof credential !== 'string' || credential.length === 0) {
          throw new Error(t('API Key was not returned'))
        }
        setNewCredential(credential)
        if (mode === 'api-key') {
          // Key recovery increments the server auth version and revokes every
          // session; clear this tab as well before returning to sign-in.
          clearAuthentication()
          setTurnstileToken('')
          setTurnstileWidgetKey((current) => current + 1)
        }
        const copySuccess = await copyToClipboard(credential)
        setCopied(copySuccess)
        if (copySuccess) {
          setTimeout(() => setCopied(false), 2000)
          toast.success(
            t(
              mode === 'api-key'
                ? 'API Key copied to clipboard'
                : 'Password copied to clipboard'
            )
          )
        } else {
          toast.success(
            t(
              mode === 'api-key'
                ? 'API Key reset successfully. Save it before continuing.'
                : 'Password reset successfully'
            )
          )
        }
      } else {
        toast.error(res?.data?.message || t('Failed to reset password'))
      }
    } catch {
      // Errors handled by global interceptor
    } finally {
      if (mode === 'api-key' && isTurnstileEnabled) {
        setTurnstileToken('')
        setTurnstileWidgetKey((current) => current + 1)
      }
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!newCredential) return

    const copySuccess = await copyToClipboard(newCredential)
    if (copySuccess) {
      setCopied(true)
      toast.success(
        t(
          mode === 'api-key'
            ? 'API Key copied to clipboard'
            : 'Password copied to clipboard'
        )
      )
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const actionLabel = isActive
    ? t('auth.resetPasswordConfirm.retry', { seconds: secondsLeft })
    : t('auth.resetPasswordConfirm.confirm')
  let submitLabel = actionLabel
  if (newCredential) {
    submitLabel = t(
      mode === 'api-key'
        ? 'Back to API Key login'
        : 'auth.resetPasswordConfirm.backToLogin'
    )
  }
  let credentialNotice = 'Password reset successfully'
  if (copied) {
    credentialNotice =
      mode === 'api-key'
        ? 'API Key has been copied to clipboard'
        : 'Password has been copied to clipboard'
  } else if (mode === 'api-key') {
    credentialNotice = 'API Key reset successfully. Save it before continuing.'
  }

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t(mode === 'api-key' ? 'Reset API Key' : 'Reset password')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {newCredential
              ? t(
                  mode === 'api-key'
                    ? 'API Key reset successfully. Save it before continuing.'
                    : 'auth.resetPasswordConfirm.success'
                )
              : t('auth.resetPasswordConfirm.description')}
          </p>
        </div>

        <div className='space-y-4'>
          {!isValidResetLink && (
            <Alert variant='destructive'>
              <AlertDescription>
                {t(
                  mode === 'api-key'
                    ? 'Invalid reset link, please request a new API Key reset.'
                    : 'Invalid reset link, please request a new password reset.'
                )}
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

          {mode === 'api-key' && isTurnstileEnabled && !newCredential && (
            <Turnstile
              key={turnstileWidgetKey}
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
            />
          )}

          {newCredential && (
            <div className='space-y-2'>
              <Label htmlFor='new-credential'>
                {t(mode === 'api-key' ? 'New API Key' : 'New password')}
              </Label>
              <div className='flex gap-2'>
                <Input
                  id='new-credential'
                  value={newCredential}
                  disabled
                  className='font-mono'
                />
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckIcon className='h-4 w-4' />
                  ) : (
                    <CopyIcon className='h-4 w-4' />
                  )}
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(credentialNotice)}
              </p>
            </div>
          )}

          <Button
            className='w-full'
            onClick={
              newCredential
                ? () => navigate({ to: '/sign-in', replace: true })
                : handleSubmit
            }
            disabled={
              newCredential ? false : loading || isActive || !isValidResetLink
            }
          >
            {submitLabel}
          </Button>

          {!newCredential && (
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
