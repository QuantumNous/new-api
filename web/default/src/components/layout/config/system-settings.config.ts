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
import { getAuthSectionNavItems } from '@/features/system-settings/auth/section-registry.tsx'
import { getContentSectionNavItems } from '@/features/system-settings/content/section-registry.tsx'
import { getGeneralSectionNavItems } from '@/features/system-settings/general/section-registry.tsx'
import { getIntegrationsSectionNavItems } from '@/features/system-settings/integrations/section-registry.tsx'
import { getMaintenanceSectionNavItems } from '@/features/system-settings/maintenance/section-registry.tsx'
import { getModelsSectionNavItems } from '@/features/system-settings/models/section-registry.tsx'
import { getRequestLimitsSectionNavItems } from '@/features/system-settings/request-limits/section-registry.tsx'
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
          icon: Settings,
          items: getGeneralSectionNavItems(t),
        },
        {
          title: t('Authentication'),
          icon: Shield,
          items: getAuthSectionNavItems(t),
        },
        {
          title: t('Request Limits'),
          icon: ShieldAlert,
          items: getRequestLimitsSectionNavItems(t),
        },
        {
          title: t('Content'),
          icon: Layout,
          items: getContentSectionNavItems(t),
        },
        {
          title: t('Integrations'),
          icon: Plug,
          items: getIntegrationsSectionNavItems(t),
        },
        {
          title: t('Models'),
          icon: Box,
          items: getModelsSectionNavItems(t),
        },
        {
          title: t('Maintenance'),
          icon: Wrench,
          items: getMaintenanceSectionNavItems(t),
        },
      ],
    },
  ]
}
