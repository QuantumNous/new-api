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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import {
  buildAssertionResult,
  isPasskeySupported,
  prepareCredentialRequestOptions,
} from '@/lib/passkey'

type PasskeyLoginUser = { id?: number } & Record<string, unknown>

interface UsePasskeyLoginOptions {
  pending?: boolean
  onSuccess: (user: PasskeyLoginUser) => void | Promise<void>
}

export function usePasskeyLogin({
  pending = false,
  onSuccess,
}: UsePasskeyLoginOptions) {
  const { t } = useTranslation()
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    isPasskeySupported()
      .then(setIsSupported)
      .catch(() => setIsSupported(false))
  }, [])

  const login = async () => {
    if (!isSupported || !navigator?.credentials) {
      toast.error(t('Passkey is not available in this browser'))
      return
    }

    setIsLoading(true)
    try {
      const begin = await beginPasskeyLogin(pending)
      if (!begin.success) {
        throw new Error(begin.message || t('Failed to start Passkey login'))
      }

      const publicKey = prepareCredentialRequestOptions(
        begin.data?.options ?? begin.data
      )
      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null
      if (!credential) {
        toast.info(t('Passkey login was cancelled'))
        return
      }

      const assertion = buildAssertionResult(credential)
      if (!assertion) {
        throw new Error(t('Invalid Passkey response'))
      }

      const finish = await finishPasskeyLogin(assertion)
      if (!finish.success) {
        throw new Error(finish.message || t('Failed to complete Passkey login'))
      }
      if (!finish.data || typeof finish.data !== 'object') {
        throw new Error(t('Missing user data from Passkey login response'))
      }

      await onSuccess(finish.data as PasskeyLoginUser)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(t('Passkey login was cancelled or timed out'))
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error(t('Passkey login failed'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { isSupported, isLoading, login }
}
