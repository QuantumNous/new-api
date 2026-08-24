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
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, CircleAlert, CircleCheck, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '../../auth-layout'
import {
  consumeRegistrationEmailVerificationRequest,
  startRegistrationEmailVerificationEffect,
  type EmailVerificationScreenState,
} from '../../lib/registration-email-verification'
import { publishRegistrationEmailVerified } from '../lib/registration-email-verification-channel'

type EmailVerificationStateProps = {
  state: EmailVerificationScreenState
}

export function EmailVerificationStatusContent(
  props: EmailVerificationStateProps
) {
  const { t } = useTranslation()

  if (props.state === 'verifying') {
    return (
      <div aria-live='polite' className='space-y-3 text-center'>
        <Loader2
          aria-hidden='true'
          className='mx-auto size-12 animate-spin text-violet-600 dark:text-violet-300'
        />
        <h2 className='text-xl font-semibold tracking-normal'>
          {t('Verifying your email')}
        </h2>
        <p className='text-muted-foreground text-sm leading-6'>
          {t('Please wait while we confirm this verification link.')}
        </p>
      </div>
    )
  }

  if (props.state === 'verified') {
    return (
      <div aria-live='polite' className='space-y-3 text-center'>
        <CircleCheck
          aria-hidden='true'
          className='mx-auto size-12 text-emerald-600 dark:text-emerald-400'
        />
        <h2 className='text-xl font-semibold tracking-normal'>
          {t('Email verified')}
        </h2>
        <p className='text-muted-foreground text-sm leading-6'>
          {t(
            'Your email is verified. Close this tab to continue registration.'
          )}
        </p>
      </div>
    )
  }

  return (
    <div aria-live='polite' className='space-y-3 text-center'>
      <CircleAlert
        aria-hidden='true'
        className='text-destructive mx-auto size-12'
      />
      <h2 className='text-xl font-semibold tracking-normal'>
        {t('Verification link unavailable')}
      </h2>
      <p className='text-muted-foreground text-sm leading-6'>
        {t(
          'This verification link is invalid or expired. Use the code in your email or request a new message.'
        )}
      </p>
    </div>
  )
}

export function EmailVerificationAction(props: EmailVerificationStateProps) {
  const { t } = useTranslation()

  if (props.state === 'verifying') return null

  if (props.state === 'verified') {
    return (
      <Button
        type='button'
        size='lg'
        className='w-full sm:w-auto'
        onClick={() => window.close()}
      >
        <X aria-hidden='true' />
        {t('Close verification tab')}
      </Button>
    )
  }

  return (
    <Button
      size='lg'
      className='w-full sm:w-auto'
      render={<Link to='/sign-up' />}
    >
      <ArrowLeft aria-hidden='true' />
      {t('Back to registration')}
    </Button>
  )
}

export function finishRegistrationEmailVerification(
  notifyRegistrationTab: () => void = publishRegistrationEmailVerified,
  closeVerificationTab: () => void = () => window.close()
): void {
  try {
    notifyRegistrationTab()
  } finally {
    closeVerificationTab()
  }
}

export function EmailVerificationScreen() {
  const [request] = useState(consumeRegistrationEmailVerificationRequest)
  const [state, setState] = useState<EmailVerificationScreenState>(() =>
    request ? 'verifying' : 'unavailable'
  )
  const completionHandledRef = useRef(false)

  useEffect(() => {
    return startRegistrationEmailVerificationEffect(request, setState)
  }, [request])

  useEffect(() => {
    if (state !== 'verified' || completionHandledRef.current) return

    completionHandledRef.current = true
    finishRegistrationEmailVerification()
  }, [state])

  return (
    <AuthLayout>
      <main className='mx-auto flex min-h-[300px] w-full max-w-sm flex-col items-center justify-center gap-7 py-6'>
        <EmailVerificationStatusContent state={state} />
        <EmailVerificationAction state={state} />
      </main>
    </AuthLayout>
  )
}
