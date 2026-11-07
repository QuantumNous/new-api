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
  Activity,
  BadgeDollarSign,
  Box,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Image,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PlugZap,
  Radio,
  Receipt,
  ServerCog,
  ShieldCheck,
  Tags,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarBadges, SidebarData } from '@/components/layout/types'
import { getSystemSettingsSectionNavItems } from '@/features/system-settings/nav'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * The groups follow a single enterprise hierarchy, ordered from the highest to
 * the lowest priority:
 *   1. Dashboard & Monitoring — daily entry points and analytics
 *   2. Users & Billing — accounts, balances and payments
 *   3. API & Models — upstream channels, model catalogue and credentials
 *   4. Security & Limits — authentication, request limits and auditing
 *   5. Logs & Operations — consumption logs and runtime behaviour
 *   6. System Configuration — platform identity, content and advanced settings
 *
 * Settings sections that belong to a group above are rendered there instead of
 * in one oversized "System Settings" list, while every item keeps its own URL
 * and its `requiredRole` keeps the route guard mirrored in the sidebar.
 */
export function useSidebarData(badges: SidebarBadges = {}): SidebarData {
  const { t } = useTranslation()
  const settings = getSystemSettingsSectionNavItems(t, badges)

  return {
    navGroups: [
      {
        id: 'dashboard',
        title: t('Dashboard & Monitoring'),
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('Control Panel'),
            url: '/admin/overview',
            icon: Gauge,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'users-billing',
        title: t('Users & Billing'),
        items: [
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
            requiredRole: ROLE.ADMIN,
          },
          settings.billing,
          {
            title: t('Payment Logs'),
            url: '/admin/payments',
            icon: Receipt,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: BadgeDollarSign,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'api-models',
        title: t('API & Models'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Group Pricing'),
            url: '/system-settings/billing/group-pricing',
            icon: Tags,
            configUrls: ['/system-settings'],
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
        ],
      },
      {
        id: 'security',
        title: t('Security & Limits'),
        items: [
          settings.auth,
          settings.security,
          {
            title: t('Audit Logs'),
            url: '/usage-logs/audit',
            icon: ClipboardList,
          },
          {
            title: t('Security & Access'),
            url: '/security',
            icon: ShieldCheck,
          },
        ],
      },
      {
        id: 'logs-operations',
        title: t('Logs & Operations'),
        items: [
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            icon: ListTodo,
          },
          {
            title: t('Drawing Logs'),
            url: '/usage-logs/drawing',
            icon: Image,
          },
          settings.operations,
        ],
      },
      {
        id: 'system',
        title: t('System Configuration'),
        items: [
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          settings.site,
          settings.content,
          settings.models,
          settings.policies,
          {
            title: t('Task Plugins'),
            url: '/task-plugins',
            icon: PlugZap,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
