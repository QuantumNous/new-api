import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_LOGO,
  STORAGE_KEYS,
} from '@/lib/constants'

export interface SystemConfig {
  systemName: string
  logo: string
  footerHtml?: string
}

interface SystemConfigState {
  config: SystemConfig
  loading: boolean
  logoLoaded: boolean
  setConfig: (config: Partial<SystemConfig>) => void
  setLogoLoaded: (loaded: boolean) => void
  setLoading: (loading: boolean) => void
}

const DEFAULT_CONFIG: SystemConfig = {
  systemName: DEFAULT_SYSTEM_NAME,
  logo: DEFAULT_LOGO,
}

/**
 * Get initial config from localStorage for instant display
 * Prevents flash of default content on page load
 */
const getInitialConfig = (): SystemConfig => {
  if (typeof window === 'undefined') return DEFAULT_CONFIG

  return {
    systemName:
      localStorage.getItem(STORAGE_KEYS.SYSTEM_NAME) ||
      DEFAULT_CONFIG.systemName,
    logo: localStorage.getItem(STORAGE_KEYS.LOGO) || DEFAULT_CONFIG.logo,
    footerHtml: localStorage.getItem(STORAGE_KEYS.FOOTER_HTML) || undefined,
  }
}

export const useSystemConfigStore = create<SystemConfigState>()(
  persist(
    (set) => ({
      config: getInitialConfig(),
      loading: true,
      logoLoaded: false,
      setConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),
      setLogoLoaded: (loaded) => set({ logoLoaded: loaded }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'system-config-storage',
      partialize: (state) => ({ config: state.config }),
    }
  )
)

// Helper functions for backward compatibility
export function getSystemName(): string {
  return useSystemConfigStore.getState().config.systemName
}

export function getLogo(): string {
  return useSystemConfigStore.getState().config.logo
}

export function getFooterHtml(): string | undefined {
  return useSystemConfigStore.getState().config.footerHtml
}
