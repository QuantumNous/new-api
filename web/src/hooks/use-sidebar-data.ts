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
  BookOpen,
  Box,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  FlaskConical,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PlugZap,
  Radio,
  ServerCog,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { useConsoleMode } from '@/hooks/use-console-mode'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  navItemVisibleToUser,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const mode = useConsoleMode()
  const user = useAuthStore((state) => state.auth.user)

  if (mode === 'easy') {
    return {
      navGroups: [
        {
          id: 'easy',
          title: t('Easy mode'),
          items: [
            {
              title: t('Overview'),
              url: '/dashboard/overview',
              icon: Activity,
            },
            {
              title: t('My key'),
              url: '/keys',
              icon: Key,
            },
            {
              title: t('Model prices'),
              url: '/pricing',
              icon: CreditCard,
            },
            {
              title: t('Beginner guide'),
              url: '/beginner-guide',
              icon: BookOpen,
            },
            {
              title: t('Spending details'),
              url: '/usage-logs/common',
              icon: FileText,
            },
            {
              title: t('Wallet'),
              url: '/wallet',
              icon: Wallet,
            },
          ],
        },
      ],
    }
  }

  const data: SidebarData = {
    navGroups: [
      {
        id: 'workspace',
        title: '',
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
        ],
      },
      {
        id: 'development',
        title: t('Development'),
        items: [
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Model Square'),
            url: '/pricing',
            icon: BookOpen,
          },
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
          },
          {
            title: t('Docs'),
            url: '/guide',
            icon: BookOpen,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Audit Logs'),
            url: '/usage-logs/audit',
            icon: ClipboardList,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'analytics',
        title: t('Analytics'),
        items: [
          {
            title: t('Usage & costs'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('Flow'),
            url: '/dashboard/flow',
            icon: Activity,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Account'),
        items: [
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
          {
            title: t('Security & Access'),
            url: '/security',
            icon: ShieldCheck,
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
            title: t('Cashback Review'),
            url: '/cashback',
            icon: HandCoins,
          },
          {
            title: t('Partner OAuth Clients'),
            url: '/partner-oauth-clients',
            icon: Key,
            requiredPermission: {
              resource: ADMIN_PERMISSION_RESOURCES.PARTNER_OAUTH_CLIENT,
              action: ADMIN_PERMISSION_ACTIONS.READ,
            },
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Task Plugins'),
            url: '/task-plugins',
            icon: PlugZap,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }

  return {
    navGroups: data.navGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => navItemVisibleToUser(user, item)),
    })),
  }
}
