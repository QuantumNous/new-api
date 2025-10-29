import { useCallback, useEffect, useMemo, useState } from 'react'
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
        toast.error(res.message || 'Failed to load Passkey status')
      }
    } catch (error) {
      console.error('[Passkey] Failed to fetch status', error)
      toast.error('Failed to load Passkey status')
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
      toast.error('This device does not support Passkey')
      return false
    }
    if (!navigator?.credentials) {
      toast.error('Passkey is not supported in this environment')
      return false
    }

    setRegistering(true)
    try {
      const beginResponse = await beginPasskeyRegistration()
      if (!beginResponse.success) {
        toast.error(
          beginResponse.message || 'Failed to start Passkey registration'
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
        toast.error('Passkey registration was cancelled')
        return false
      }

      const attestation = buildRegistrationResult(credential)
      if (!attestation) {
        toast.error('Invalid Passkey registration response')
        return false
      }

      const finishResponse = await finishPasskeyRegistration(attestation)
      if (!finishResponse.success) {
        toast.error(finishResponse.message || 'Failed to register Passkey')
        return false
      }

      toast.success('Passkey registered successfully')
      await fetchStatus()
      return true
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info('Passkey registration was cancelled')
        return false
      }
      console.error('[Passkey] Registration error', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to register Passkey'
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
        toast.error(res.message || 'Failed to remove Passkey')
        return false
      }

      toast.success('Passkey removed successfully')
      await fetchStatus()
      return true
    } catch (error) {
      console.error('[Passkey] Removal error', error)
      toast.error('Failed to remove Passkey')
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
