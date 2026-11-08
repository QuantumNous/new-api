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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  useSecureVerification,
  type SecurityProofScope,
  type VerificationMethod,
} from '@/features/auth/secure-verification'
import { useAuthStore } from '@/stores/auth-store'

import {
  createAccessToken,
  getAccessTokenCatalog,
  listAccessTokens,
  revokeAccessToken,
  revokeLegacyAccessToken,
  updateAccessToken,
  type AccessTokenInput,
  type AccessTokenUpdate,
} from '../api'

interface VerifiedOperation {
  scope: SecurityProofScope
  title: string
  description: string
}

export function useAccessTokens() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const sessionId = useAuthStore((state) => state.auth.session?.sid)
  const [createdToken, setCreatedToken] = useState<{
    value: string
    userId: number | undefined
    sessionId: string | undefined
  } | null>(null)
  const [pending, setPending] = useState(false)
  const currentOperation = useRef<AbortController | null>(null)

  // The fork's useSecureVerification drives both the dialog and the API call:
  // it verifies, then runs the registered call with the proof token. This ref
  // hands the call's result back to the operation that started verification so
  // dialogs close only after the whole flow succeeded; cancelling resolves
  // with undefined instead.
  const settleOperation = useRef<((result: unknown) => void) | null>(null)

  const finishOperation = useCallback((result: unknown) => {
    const settle = settleOperation.current
    settleOperation.current = null
    currentOperation.current = null
    setPending(false)
    settle?.(result)
  }, [])

  const listQueryKey = useCallback(
    () => ['security', 'access-tokens', 'list', userId],
    [userId]
  )

  const verification = useSecureVerification({
    onSuccess: useCallback(
      (result: unknown) => {
        void client.invalidateQueries({ queryKey: listQueryKey() })
        finishOperation(result)
      },
      [client, listQueryKey, finishOperation]
    ),
  })
  const {
    open: verificationOpen,
    state: verificationState,
    methods: verificationMethods,
    startVerification,
    executeVerification,
    cancel: cancelVerification,
    setCode: setVerificationCode,
    switchMethod: switchVerificationMethod,
  } = verification

  const list = useQuery({
    queryKey: listQueryKey(),
    queryFn: listAccessTokens,
    retry: false,
  })
  const catalog = useQuery({
    queryKey: ['security', 'access-tokens', 'catalog', userId],
    queryFn: getAccessTokenCatalog,
    retry: false,
  })

  // When the verification dialog closes without a success (cancel), resolve
  // the pending operation as failed. On success finishOperation runs first and
  // clears the ref, so this is a no-op.
  useEffect(() => {
    if (!verificationOpen) finishOperation(undefined)
  }, [verificationOpen, finishOperation])

  useEffect(
    () => () => {
      const current = currentOperation.current
      currentOperation.current = null
      settleOperation.current = null
      current?.abort()
      cancelVerification()
      setPending(false)
      setCreatedToken(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelVerification, userId, sessionId]
  )

  // Runs one verified operation at a time. The proof and plaintext stay local
  // to the action, outside React Query caches. Resolves with the API result on
  // success and undefined when verification was cancelled or refused.
  const runVerified = useCallback(
    <T>(
      operation: (proofToken: string, signal: AbortSignal) => Promise<T>,
      config: VerifiedOperation
    ): Promise<T | undefined> => {
      if (settleOperation.current) return Promise.resolve(undefined)
      return new Promise<T | undefined>((resolve) => {
        settleOperation.current = (result) => resolve(result as T | undefined)
        const controller = new AbortController()
        currentOperation.current = controller
        setPending(true)
        void (async () => {
          try {
            const started = await startVerification(
              (proofToken) => operation(proofToken ?? '', controller.signal),
              config
            )
            // startVerification answers false when no verification method is
            // enrolled, so the dialog never opened and nothing will settle.
            if (!started) finishOperation(undefined)
          } catch {
            finishOperation(undefined)
          }
        })()
      })
    },
    [startVerification, finishOperation]
  )

  const verificationPrompt = useCallback(
    (scope: SecurityProofScope): VerifiedOperation => ({
      scope,
      title: t('Security verification'),
      description: t(
        'Confirm your identity before accessing this sensitive action.'
      ),
    }),
    [t]
  )

  const create = useCallback(
    async (input: AccessTokenInput) => {
      const created = await runVerified(
        (proofToken, signal) => createAccessToken(input, proofToken, signal),
        verificationPrompt('access_token.generate')
      )
      if (!created) return false
      setCreatedToken({ value: created.token, userId, sessionId })
      return true
    },
    [runVerified, verificationPrompt, userId, sessionId]
  )

  const revoke = useCallback(
    async (id: number) => {
      const revoked = await runVerified(
        (proofToken, signal) => revokeAccessToken(id, proofToken, signal),
        verificationPrompt('access_token.revoke')
      )
      if (revoked) toast.success(t('Access token revoked'))
      return revoked === true
    },
    [runVerified, verificationPrompt, t]
  )

  const revokeLegacy = useCallback(async () => {
    const revoked = await runVerified(
      (proofToken, signal) => revokeLegacyAccessToken(proofToken, signal),
      verificationPrompt('access_token.revoke')
    )
    if (revoked) toast.success(t('Access token revoked'))
    return revoked === true
  }, [runVerified, verificationPrompt, t])

  // A name-only edit saves directly; changing the grant asks for security
  // verification bound to the token and the new scopes.
  const update = useCallback(
    async (id: number, input: AccessTokenUpdate) => {
      const scopes = input.scopes
      if (!scopes) {
        setPending(true)
        try {
          await updateAccessToken(id, { name: input.name })
          toast.success(t('Saved successfully'))
          return true
        } catch {
          // The axios interceptor already surfaced the backend message.
          return false
        } finally {
          setPending(false)
        }
      }
      const updated = await runVerified(
        (proofToken, signal) =>
          updateAccessToken(
            id,
            { name: input.name, scopes },
            { token: proofToken, signal }
          ),
        verificationPrompt('access_token.update')
      )
      if (updated !== undefined) toast.success(t('Saved successfully'))
      return updated !== undefined
    },
    [runVerified, verificationPrompt, t]
  )

  const handleDialogVerify = useCallback(
    async (method: VerificationMethod, code?: string) => {
      try {
        await executeVerification(method, code)
      } catch {
        // Errors are already surfaced by useSecureVerification via toast.
      }
    },
    [executeVerification]
  )

  return {
    list,
    catalog,
    createdToken:
      createdToken &&
      createdToken.userId === userId &&
      createdToken.sessionId === sessionId
        ? createdToken.value
        : '',
    clearCreatedToken: () => {
      setCreatedToken(null)
    },
    pending,
    create,
    revoke,
    revokeLegacy,
    update,
    updatePending: pending,
    showVerification: verificationOpen,
    verificationDialogProps: {
      open: verificationOpen,
      onOpenChange: (open: boolean) => {
        if (!open && !verificationState.loading) cancelVerification()
      },
      methods: verificationMethods,
      state: verificationState,
      onVerify: handleDialogVerify,
      onCancel: cancelVerification,
      onCodeChange: setVerificationCode,
      onMethodChange: switchVerificationMethod,
    },
  }
}
