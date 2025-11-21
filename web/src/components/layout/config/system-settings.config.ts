import { type TFunction } from 'i18next'
import {
  Settings,
  Shield,
  ShieldAlert,
  Layout,
  Plug,
  Box,
  Wrench,
} from 'lucide-react'
import { type NavGroup } from '../types'

/**
 * System settings sidebar configuration
 * Displayed when switching to "System Settings" workspace
 */
export const WORKSPACE_SYSTEM_SETTINGS_ID = 'system-settings'

export function getSystemSettingsNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'system-administration',
      title: t('System Administration'),
      items: [
        {
          title: t('General'),
          url: '/system-settings/general',
          icon: Settings,
        },
        {
          title: t('Authentication'),
          url: '/system-settings/auth',
          icon: Shield,
        },
        {
          title: t('Request Limits'),
          url: '/system-settings/request-limits',
          icon: ShieldAlert,
        },
        {
          title: t('Content'),
          url: '/system-settings/content',
          icon: Layout,
        },
        {
          title: t('Integrations'),
          url: '/system-settings/integrations',
          icon: Plug,
        },
        {
          title: t('Models'),
          url: '/system-settings/models',
          icon: Box,
        },
        {
          title: t('Maintenance'),
          url: '/system-settings/maintenance',
          icon: Wrench,
        },
      ],
    },
  ]
}
