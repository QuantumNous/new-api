import { useEffect } from 'react'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { DEFAULT_LOGO } from '@/lib/constants'

/**
 * Hook to manage system configuration including logo and system name
 * Automatically handles logo preloading and loading states
 */
export function useSystemConfig() {
  const { config, loading, logoLoaded, setLogoLoaded } = useSystemConfigStore()

  // Preload logo image
  useEffect(() => {
    if (!config.logo) {
      setLogoLoaded(false)
      return
    }

    setLogoLoaded(false)
    const img = new Image()
    img.src = config.logo
    img.onload = () => setLogoLoaded(true)
    img.onerror = () => {
      // Only log error for non-default logos to avoid console noise
      if (config.logo !== DEFAULT_LOGO) {
        console.error('Failed to load logo:', config.logo)
      }
      setLogoLoaded(true) // Set to true even on error to prevent infinite loading
    }
  }, [config.logo, setLogoLoaded])

  // Note: Loading state is managed by useLoadSystemConfig
  // which is called in the root component

  return {
    systemName: config.systemName,
    logo: config.logo,
    footerHtml: config.footerHtml,
    loading,
    logoLoaded,
    config,
  }
}
