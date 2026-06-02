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
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SecureVerificationDialog } from './secure-verification-dialog'
import { useSecureVerification } from '../hooks/use-secure-verification'
import { registerSecureVerificationHandler } from '../secure-verification-request'
import type { VerificationMethod } from '../types'

export function GlobalSecureVerificationDialog() {
  const { t } = useTranslation()
  const {
    open,
    setOpen,
    methods,
    state,
    executeVerification,
    cancel,
    setCode,
    switchMethod,
    verifyThenRun,
  } = useSecureVerification({
    autoFetchMethods: false,
  })

  useEffect(() => {
    return registerSecureVerificationHandler(async ({ apiCall, options }) => {
      return await verifyThenRun(apiCall, {
        preferredMethod: options?.preferredMethod ?? 'passkey',
        title: options?.title ?? t('Additional verification required'),
        description:
          options?.description ??
          t('Confirm your identity before accessing this sensitive action.'),
      })
    })
  }, [t, verifyThenRun])

  const handleVerify = useCallback(
    async (method: VerificationMethod, code?: string) => {
      try {
        await executeVerification(method, code)
      } catch {
        // The hook already surfaces verification and retry errors with toasts.
      }
    },
    [executeVerification]
  )

  return (
    <SecureVerificationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true)
          return
        }
        cancel()
      }}
      methods={methods}
      state={state}
      onVerify={handleVerify}
      onCancel={cancel}
      onCodeChange={setCode}
      onMethodChange={switchMethod}
    />
  )
}
