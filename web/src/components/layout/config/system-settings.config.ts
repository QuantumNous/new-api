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
export const systemSettingsConfig: NavGroup[] = [
  {
    title: 'System Administration',
    items: [
      {
        title: 'General',
        url: '/system-settings/general',
        icon: Settings,
      },
      {
        title: 'Authentication',
        url: '/system-settings/auth',
        icon: Shield,
      },
      {
        title: 'Request Limits',
        url: '/system-settings/request-limits',
        icon: ShieldAlert,
      },
      {
        title: 'Content',
        url: '/system-settings/content',
        icon: Layout,
      },
      {
        title: 'Integrations',
        url: '/system-settings/integrations',
        icon: Plug,
      },
      {
        title: 'Models',
        url: '/system-settings/models',
        icon: Box,
      },
      {
        title: 'Maintenance',
        url: '/system-settings/maintenance',
        icon: Wrench,
      },
    ],
  },
]
