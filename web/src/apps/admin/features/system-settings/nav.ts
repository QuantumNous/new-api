/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { TFunction } from 'i18next'
import {
  Box,
  CreditCard,
  Layout,
  Route,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
} from 'lucide-react'

import type { NavCollapsible, SidebarBadges } from '@/shared/components/layout/types'
import { ROLE } from '@/shared/lib/roles'

import { getAuthSectionNavItems } from './auth/section-registry.tsx'
import { getBillingSectionNavItems } from './billing/section-registry.tsx'
import { getContentSectionNavItems } from './content/section-registry.tsx'
import { getModelsSectionNavItems } from './models/section-registry.tsx'
import { getOperationsSectionNavItems } from './operations/section-registry.tsx'
import { getPolicySectionNavItems } from './request-policies/section-registry'
import { getSecuritySectionNavItems } from './security/section-registry.tsx'
import { getSiteSectionNavItems } from './site/section-registry.tsx'

/**
 * Settings sections, keyed so the main sidebar can place each of them in the
 * group it belongs to (billing with billing, operations with logs, and so on)
 * instead of listing all of them in one oversized settings group.
 */
export type SystemSettingsSectionId =
  | 'site'
  | 'auth'
  | 'billing'
  | 'models'
  | 'policies'
  | 'security'
  | 'content'
  | 'operations'

/**
 * System settings sections rendered in the main admin sidebar.
 *
 * Every entry points at the same admin settings module, so disabling
 * "System Settings" in the sidebar configuration hides all of them, and the
 * super administrator requirement mirrors the `/admin/system-settings` route guard.
 */
export function getSystemSettingsSectionNavItems(
  t: TFunction,
  badges: SidebarBadges
): Record<SystemSettingsSectionId, NavCollapsible> {
  return {
    site: {
      title: t('Site & Branding'),
      icon: Settings,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getSiteSectionNavItems(t),
    },
    auth: {
      title: t('Authentication'),
      icon: Shield,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getAuthSectionNavItems(t),
    },
    billing: {
      title: t('Billing & Payment'),
      icon: CreditCard,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      badge: badges.modelPricing,
      items: getBillingSectionNavItems(t, {
        'model-pricing': badges.modelPricing,
      }),
    },
    models: {
      title: t('Models'),
      icon: Box,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getModelsSectionNavItems(t),
    },
    policies: {
      title: t('Request policies'),
      icon: Route,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getPolicySectionNavItems(t),
    },
    security: {
      title: t('Security & Limits'),
      icon: ShieldAlert,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getSecuritySectionNavItems(t),
    },
    content: {
      title: t('Console Content'),
      icon: Layout,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getContentSectionNavItems(t),
    },
    operations: {
      title: t('Operations'),
      icon: Wrench,
      configUrls: ['/admin/system-settings'],
      requiredRole: ROLE.SUPER_ADMIN,
      items: getOperationsSectionNavItems(t),
    },
  }
}
