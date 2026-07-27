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
  Box,
  CreditCard,
  FileText,
  FlaskConical,
  HeartPulse,
  Key,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  PenTool,
  Radio,
  ServerCog,
  Settings,
  Ticket,
  ClipboardCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * Order mirrors Apilio-style console:
 *   Console (Dashboard / Token / Wallet) → Tools (Chat) → Logs → Personal → Admin
 *
 * Visibility is further gated by SidebarModulesAdmin / user sidebar_modules
 * via {@link useSidebarConfig}.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'console',
        title: t('Console'),
        items: [
          {
            title: t('Dashboard'),
            url: '/dashboard/overview',
            activeUrls: ['/dashboard'],
            configUrls: [
              '/dashboard',
              '/dashboard/overview',
              '/dashboard/models',
            ],
            icon: LayoutDashboard,
          },
          {
            title: t('Group status'),
            url: '/group-status',
            icon: HeartPulse,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
        ],
      },
      {
        id: 'tools',
        title: t('Tools'),
        items: [
          {
            title: t('Inspiration'),
            url: '/inspiration',
            activeUrls: ['/inspiration'],
            icon: PenTool,
          },
          {
            title: t('Chat apps'),
            icon: FlaskConical,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'logs',
        title: t('Log monitoring'),
        items: [
          {
            title: t('Analytics'),
            url: '/dashboard/models',
            icon: Activity,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Inspiration templates'),
            url: '/inspiration-admin',
            icon: Lightbulb,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('Top-up Reviews'),
            url: '/topup-reviews',
            icon: ClipboardCheck,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}
