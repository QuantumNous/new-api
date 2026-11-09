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
import {
  BadgeDollarSign,
  Box,
  ClipboardList,
  Gauge,
  PlugZap,
  Radio,
  Receipt,
  ServerCog,
  Tags,
  Ticket,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useModelPricingIssueBadge } from '@/apps/admin/features/model-pricing/pricing-issues'
import { getSystemSettingsSectionNavItems } from '@/apps/admin/features/system-settings/nav'
import type {
  SidebarBadges,
  SidebarData,
} from '@/shared/components/layout/types'
import { ROLE } from '@/shared/lib/roles'

/**
 * Navigation for the admin portal.
 *
 * Only administrative surfaces are listed here; end-user features live in the
 * client portal navigation.
 */
export function useAdminSidebarData(): SidebarData {
  const { t } = useTranslation()
  const badges: SidebarBadges = { modelPricing: useModelPricingIssueBadge() }
  const settings = getSystemSettingsSectionNavItems(t, badges)

  return {
    navGroups: [
      {
        id: 'admin-console',
        title: t('Control Panel'),
        items: [
          {
            title: t('Overview'),
            url: '/admin/overview',
            icon: Gauge,
          },
          {
            title: t('Users'),
            url: '/admin/users',
            icon: Users,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Redemption Codes'),
            url: '/admin/redemption-codes',
            icon: Ticket,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Subscriptions'),
            url: '/admin/subscriptions',
            icon: BadgeDollarSign,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Payment Logs'),
            url: '/admin/payments',
            icon: Receipt,
            requiredRole: ROLE.ADMIN,
          },
        ],
      },
      {
        id: 'admin-api',
        title: t('API & Models'),
        items: [
          {
            title: t('Channels'),
            url: '/admin/channels',
            icon: Radio,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Models'),
            url: '/admin/models/metadata',
            icon: Box,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Group Pricing'),
            url: '/admin/system-settings/billing/group-pricing',
            icon: Tags,
            configUrls: ['/admin/system-settings'],
            requiredRole: ROLE.SUPER_ADMIN,
          },
          settings.billing,
          {
            title: t('Task Plugins'),
            url: '/admin/task-plugins',
            icon: PlugZap,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
      {
        id: 'admin-security',
        title: t('Security & Limits'),
        items: [
          {
            title: t('Audit Logs'),
            url: '/admin/audit-logs',
            icon: ClipboardList,
            requiredRole: ROLE.ADMIN,
          },
          settings.auth,
          settings.security,
        ],
      },
      {
        id: 'admin-system',
        title: t('System Configuration'),
        items: [
          {
            title: t('System Info'),
            url: '/admin/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          settings.site,
          settings.content,
          settings.models,
          settings.policies,
          settings.operations,
        ],
      },
    ],
  }
}
