import { useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { getOAuthState } from '../api'
import {
  buildGitHubOAuthUrl,
  buildOIDCOAuthUrl,
  buildLinuxDOOAuthUrl,
} from '../lib/oauth'
import type { SystemStatus } from '../types'

type LogoutRequestConfig = AxiosRequestConfig & {
  skipErrorHandler?: boolean
}

/**
 * Hook for managing OAuth login
 */
export function useOAuthLogin(status: SystemStatus | null) {
  const [isLoading, setIsLoading] = useState(false)
  const { auth } = useAuthStore()

  const resetSession = async () => {
    try {
      auth.reset()
    } catch (_error) {
      // ignore store reset errors
    }
    try {
      await api.get('/api/user/logout', {
        skipErrorHandler: true,
      } as LogoutRequestConfig)
    } catch (_error) {
      // ignore logout errors
    }
  }

  const handleGitHubLogin = async () => {
    if (!status?.github_client_id) return

    setIsLoading(true)
    try {
      await resetSession()
      const state = await getOAuthState()
      if (!state) {
        toast.error('Failed to initialize OAuth')
        return
      }

      const url = buildGitHubOAuthUrl(status.github_client_id, state)
      window.open(url, '_self')
    } catch (_error) {
      toast.error('Failed to start GitHub login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOIDCLogin = async () => {
    if (!status?.oidc_authorization_endpoint || !status?.oidc_client_id) return

    setIsLoading(true)
    try {
      await resetSession()
      const state = await getOAuthState()
      if (!state) {
        toast.error('Failed to initialize OAuth')
        return
      }

      const url = buildOIDCOAuthUrl(
        status.oidc_authorization_endpoint,
        status.oidc_client_id,
        state
      )
      window.open(url, '_self')
    } catch (_error) {
      toast.error('Failed to start OIDC login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinuxDOLogin = async () => {
    if (!status?.linuxdo_client_id) return

    setIsLoading(true)
    try {
      await resetSession()
      const state = await getOAuthState()
      if (!state) {
        toast.error('Failed to initialize OAuth')
        return
      }

      const url = buildLinuxDOOAuthUrl(status.linuxdo_client_id, state)
      window.open(url, '_self')
    } catch (_error) {
      toast.error('Failed to start LinuxDO login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTelegramLogin = () => {
    toast.info('Telegram login requires widget integration; coming soon')
  }

  return {
    isLoading,
    handleGitHubLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
  }
}
