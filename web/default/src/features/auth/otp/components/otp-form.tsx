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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { login2fa } from '@/features/auth/api'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { usePasskeyLogin } from '@/features/auth/hooks/use-passkey-login'
import {
  SecureVerificationDialog,
  type SecureVerificationState,
  type VerificationMethod,
  type VerificationMethods,
} from '@/features/auth/secure-verification'
import type { LoginVerificationRequirements } from '@/features/auth/types'

type LoginVerificationProps = {
  requirements: LoginVerificationRequirements
}

export function LoginVerification(props: LoginVerificationProps) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<VerificationMethod | null>(null)
  const [code, setCode] = useState('')
  const [twoFALoading, setTwoFALoading] = useState(false)
  const { handleLoginSuccess, redirectToLogin } = useAuthRedirect()
  const has2FA = Boolean(props.requirements.require_2fa)
  const hasPasskey = Boolean(props.requirements.require_passkey)
  const {
    isSupported: passkeySupported,
    isLoading: passkeyLoading,
    login: verifyPasskey,
  } = usePasskeyLogin({
    pending: true,
    onSuccess: async (userData) => {
      await handleLoginSuccess(userData)
      toast.success(t('Signed in'))
    },
  })

  let description = t(
    'Use an authenticator code or Passkey to complete sign-in.'
  )
  if (has2FA && !hasPasskey) {
    description = t('Please enter the authentication code.')
  } else if (hasPasskey && !has2FA) {
    description = t('Sign in with Passkey')
  }

  const methods: VerificationMethods = {
    has2FA,
    hasPasskey,
    passkeySupported,
  }
  const state: SecureVerificationState = {
    method,
    loading: twoFALoading || passkeyLoading,
    code,
    title: t('Additional verification required'),
    description,
  }

  async function handleVerify(
    verificationMethod: VerificationMethod,
    verificationCode?: string
  ) {
    if (verificationMethod === 'passkey') {
      await verifyPasskey()
      return
    }

    setTwoFALoading(true)
    try {
      const res = await login2fa({ code: verificationCode?.trim() ?? '' })
      if (!res.success) {
        throw new Error(res.message || t('Invalid code'))
      }
      if (!res.data) {
        throw new Error('No user data received from login')
      }

      await handleLoginSuccess(res.data)
      toast.success(t('Signed in'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Verification failed')
      )
    } finally {
      setTwoFALoading(false)
    }
  }

  return (
    <SecureVerificationDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          redirectToLogin()
        }
      }}
      methods={methods}
      state={state}
      onVerify={handleVerify}
      onCancel={redirectToLogin}
      onCodeChange={setCode}
      onMethodChange={(nextMethod) => {
        setMethod(nextMethod)
        setCode('')
      }}
    />
  )
}
