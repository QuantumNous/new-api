import { useCallback, useEffect, useMemo, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import {
  buildRegistrationResult,
  createCredential,
  isPasskeySupported as detectPasskeySupport,
  prepareCredentialCreationOptions,
} from '@/lib/passkey'
import {
  beginPasskeyRegistration,
  deletePasskey,
  finishPasskeyRegistration,
  getPasskeyStatus,
} from '../api'
import type { PasskeyStatus } from '../types'

interface UsePasskeyManagementOptions {
  onStatusChange?: (status: PasskeyStatus | null) => void
}

export function usePasskeyManagement(
  options: UsePasskeyManagementOptions = {}
) {
  const { onStatusChange } = options

  const [status, setStatus] = useState<PasskeyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [supported, setSupported] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getPasskeyStatus()
      if (res.success) {
        setStatus(res.data ?? null)
        onStatusChange?.(res.data ?? null)
      } else {
        setStatus(null)
        toast.error(res.message || i18next.t('Failed to load Passkey status'))
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Passkey] Failed to fetch status', error)
      toast.error(i18next.t('Failed to load Passkey status'))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [onStatusChange])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    detectPasskeySupport()
      .then(setSupported)
      .catch(() => setSupported(false))
  }, [])

  const register = useCallback(async () => {
    if (!supported) {
      toast.error(i18next.t('This device does not support Passkey'))
      return false
    }
    if (!navigator?.credentials) {
      toast.error(i18next.t('Passkey is not supported in this environment'))
      return false
    }

    setRegistering(true)
    try {
      const beginResponse = await beginPasskeyRegistration()
      if (!beginResponse.success) {
        toast.error(
          beginResponse.message ||
            i18next.t('Failed to start Passkey registration')
        )
        return false
      }

      const publicKey = prepareCredentialCreationOptions(
        beginResponse.data?.options ?? beginResponse.data
      )

      const credential = (await createCredential(
        publicKey
      )) as PublicKeyCredential | null
      if (!credential) {
        toast.error(i18next.t('Passkey registration was cancelled'))
        return false
      }

      const attestation = buildRegistrationResult(credential)
      if (!attestation) {
        toast.error(i18next.t('Invalid Passkey registration response'))
        return false
      }

      const finishResponse = await finishPasskeyRegistration(attestation)
      if (!finishResponse.success) {
        toast.error(
          finishResponse.message || i18next.t('Failed to register Passkey')
        )
        return false
      }

      toast.success(i18next.t('Passkey registered successfully'))
      await fetchStatus()
      return true
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(i18next.t('Passkey registration was cancelled'))
        return false
      }
      // eslint-disable-next-line no-console
      console.error('[Passkey] Registration error', error)
      toast.error(
        error instanceof Error
          ? error.message
          : i18next.t('Failed to register Passkey')
      )
      return false
    } finally {
      setRegistering(false)
    }
  }, [supported, fetchStatus])

  const remove = useCallback(async () => {
    setRemoving(true)
    try {
      const res = await deletePasskey()
      if (!res.success) {
        toast.error(res.message || i18next.t('Failed to remove Passkey'))
        return false
      }

      toast.success(i18next.t('Passkey removed successfully'))
      await fetchStatus()
      return true
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Passkey] Removal error', error)
      toast.error(i18next.t('Failed to remove Passkey'))
      return false
    } finally {
      setRemoving(false)
    }
  }, [fetchStatus])

  const enabled = useMemo(() => Boolean(status?.enabled), [status])
  const lastUsed = useMemo(() => status?.last_used_at ?? null, [status])

  return {
    status,
    loading,
    registering,
    removing,
    supported,
    enabled,
    lastUsed,
    fetchStatus,
    register,
    remove,
  }
}
