import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuthUser } from '@/stores/auth-store'
import { getRoleLabel } from '@/lib/roles'

/**
 * Custom hook to format user display information
 * Centralizes user display logic used across ProfileDropdown and MobileDrawer
 */
export function useUserDisplay(user: AuthUser | null | undefined) {
  const { t } = useTranslation()
  return useMemo(() => {
    if (!user) {
      return {
        displayName: t('User'),
        secondaryText: '',
        initials: 'U',
        roleLabel: '',
      }
    }

    // Display name: priority order
    const displayName = user.display_name || user.username || t('User')

    // Secondary text: first available identifier
    const secondaryText = (() => {
      if (user.email) return user.email
      if (user.github_id) return `GitHub ID: ${user.github_id}`
      if (user.oidc_id) return `OIDC ID: ${user.oidc_id}`
      if (user.wechat_id) return `WeChat ID: ${user.wechat_id}`
      if (user.telegram_id) return `Telegram ID: ${user.telegram_id}`
      if (user.linux_do_id) return `LinuxDO ID: ${user.linux_do_id}`
      if (user.username) return user.username
      if (user.display_name) return user.display_name
      return ''
    })()

    // Generate initials from display name
    const initials = displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // Get role label
    const roleLabel = getRoleLabel(user.role)

    return {
      displayName,
      secondaryText,
      initials,
      roleLabel,
    }
  }, [user, t])
}
