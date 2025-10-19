import { useEffect } from 'react'
import {
  useSystemConfigStore,
  type SystemConfig,
} from '@/stores/system-config-store'
import {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_LOGO,
  STORAGE_KEYS,
} from '@/lib/constants'

/**
 * Hook to load system configuration from backend on app initialization
 * Should be called in the root component
 *
 * Loading strategy:
 * 1. Initial state loaded from localStorage (by store)
 * 2. Fetch from backend API
 * 3. Update store and localStorage with fresh data
 */
export function useLoadSystemConfig() {
  const { setConfig, setLoading } = useSystemConfigStore()

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true)

        // Fetch from backend to get latest data
        const response = await fetch('/api/status')
        if (!response.ok) throw new Error('Failed to fetch status')

        const data = await response.json()
        if (!data.success) throw new Error('API returned error')

        const newConfig: SystemConfig = {
          systemName: data.data.system_name || DEFAULT_SYSTEM_NAME,
          logo: data.data.logo || DEFAULT_LOGO,
          footerHtml: data.data.footer_html,
        }

        // Update store
        setConfig(newConfig)

        // Update localStorage for next time
        localStorage.setItem(STORAGE_KEYS.SYSTEM_NAME, newConfig.systemName)
        localStorage.setItem(STORAGE_KEYS.LOGO, newConfig.logo)
        if (newConfig.footerHtml) {
          localStorage.setItem(STORAGE_KEYS.FOOTER_HTML, newConfig.footerHtml)
        } else {
          localStorage.removeItem(STORAGE_KEYS.FOOTER_HTML)
        }
      } catch (error) {
        console.error('Failed to load system config:', error)
        // Keep using cached/default config from store initialization
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [setConfig, setLoading])
}
