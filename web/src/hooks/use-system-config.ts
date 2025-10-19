import { useEffect, useCallback } from 'react'
import {
  useSystemConfigStore,
  type SystemConfig,
} from '@/stores/system-config-store'
import { DEFAULT_SYSTEM_NAME, DEFAULT_LOGO } from '@/lib/constants'

interface UseSystemConfigOptions {
  /** Automatically fetch config from backend (use only in root component) */
  autoLoad?: boolean
}

interface StatusApiResponse {
  success: boolean
  data: {
    system_name?: string
    logo?: string
    footer_html?: string
  }
}

// Fetch system config from API
async function fetchSystemConfig(): Promise<SystemConfig> {
  const response = await fetch('/api/status')
  if (!response.ok) throw new Error('Failed to fetch status')

  const data: StatusApiResponse = await response.json()
  if (!data.success) throw new Error('API returned error')

  return {
    systemName: data.data.system_name || DEFAULT_SYSTEM_NAME,
    logo: data.data.logo || DEFAULT_LOGO,
    footerHtml: data.data.footer_html,
  }
}

// Preload image and return cleanup function
function preloadImage(
  src: string,
  onLoad: () => void,
  onError: () => void
): () => void {
  const img = new Image()
  img.onload = onLoad
  img.onerror = onError
  img.src = src

  return () => {
    img.onload = null
    img.onerror = null
  }
}

/**
 * System configuration hook with auto-loading and logo preloading
 *
 * @example
 * // Root component - auto-load from backend
 * useSystemConfig({ autoLoad: true })
 *
 * @example
 * // Other components - use cached config
 * const { systemName, logo, loading } = useSystemConfig()
 */
export function useSystemConfig(options: UseSystemConfigOptions = {}) {
  const { autoLoad = false } = options
  const {
    config,
    loading,
    loadedLogoUrl,
    setConfig,
    setLoadedLogoUrl,
    setLoading,
  } = useSystemConfigStore()

  // Load config from backend
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const newConfig = await fetchSystemConfig()
      setConfig(newConfig)
    } catch (error) {
      console.error('Failed to load system config:', error)
    } finally {
      setLoading(false)
    }
  }, [setConfig, setLoading])

  useEffect(() => {
    if (autoLoad) loadConfig()
  }, [autoLoad, loadConfig])

  // Preload logo image when URL changes
  useEffect(() => {
    const { logo } = config

    // Skip if logo is already loaded
    if (!logo || logo === loadedLogoUrl) return

    // Preload new logo
    return preloadImage(
      logo,
      () => setLoadedLogoUrl(logo),
      () => {
        if (logo !== DEFAULT_LOGO) {
          console.error('Failed to load logo:', logo)
        }
        // Mark as loaded even on error to prevent infinite retry
        setLoadedLogoUrl(logo)
      }
    )
  }, [config.logo, loadedLogoUrl, setLoadedLogoUrl])

  return {
    ...config,
    loading,
    logoLoaded: config.logo === loadedLogoUrl && !!loadedLogoUrl,
  }
}
