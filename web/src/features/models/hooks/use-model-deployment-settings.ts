import { useCallback, useEffect, useState } from 'react'
import { getDeploymentSettings, testDeploymentConnection } from '../api'

interface ConnectionState {
  loading: boolean
  ok: boolean | null
  error: string | null
}

export function useModelDeploymentSettings() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, unknown>>({
    'model_deployment.ionet.enabled': false,
  })
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    loading: false,
    ok: null,
    error: null,
  })

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getDeploymentSettings()
      if (response?.success) {
        // Backend returns { enabled, configured, can_connect, ... }
        setSettings({
          'model_deployment.ionet.enabled': response?.data?.enabled === true,
        })
      }
    } catch {
      // Ignore errors, use default settings
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const isIoNetEnabled = Boolean(settings['model_deployment.ionet.enabled'])

  const testConnection = useCallback(async () => {
    setConnectionState({ loading: true, ok: null, error: null })
    try {
      const response = await testDeploymentConnection()
      if (response?.success) {
        setConnectionState({ loading: false, ok: true, error: null })
        return
      }
      const message = response?.message || 'Connection failed'
      setConnectionState({ loading: false, ok: false, error: message })
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Connection failed'
      setConnectionState({ loading: false, ok: false, error: errMsg })
    }
  }, [])

  // Auto test connection when enabled
  useEffect(() => {
    if (!loading && isIoNetEnabled) {
      testConnection()
      return
    }
    setConnectionState({ loading: false, ok: null, error: null })
  }, [loading, isIoNetEnabled, testConnection])

  // Refresh on window focus (useful after saving settings in another page)
  useEffect(() => {
    const handler = () => {
      fetchSettings()
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [fetchSettings])

  return {
    loading,
    settings,
    isIoNetEnabled,
    refresh: fetchSettings,
    connectionLoading: connectionState.loading,
    connectionOk: connectionState.ok,
    connectionError: connectionState.error,
    testConnection,
  }
}
