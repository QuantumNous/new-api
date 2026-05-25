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
  Activity,
  Box,
  CreditCard,
  FileText,
  FlaskConical,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Radio,
  Settings,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { PLATFORM_ROUTES } from '@/lib/platform-routes'
import type { NavGroup } from '../types'

export function getConsoleNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'console',
      title: t('API Console'),
      items: [
        {
          title: t('Playground'),
          url: '/console/playground',
          icon: FlaskConical,
        },
        {
          title: t('Overview'),
          url: '/console/dashboard/overview',
          icon: Activity,
        },
        {
          title: t('Dashboard'),
          url: '/console/dashboard/models',
          icon: LayoutDashboard,
        },
        {
          title: t('API Keys'),
          url: '/console/keys',
          icon: Key,
        },
        {
          title: t('Usage Logs'),
          url: '/console/usage-logs/common',
          icon: FileText,
        },
        {
          title: t('Task Logs'),
          url: '/console/usage-logs/task',
          activeUrls: ['/console/usage-logs/drawing'],
          configUrls: [
            '/console/usage-logs/drawing',
            '/console/usage-logs/task',
          ],
          icon: ListTodo,
        },
      ],
    },
    {
      id: 'personal',
      title: t('Personal'),
      items: [
        {
          title: t('Wallet'),
          url: '/console/wallet',
          icon: Wallet,
        },
        {
          title: t('Profile'),
          url: '/console/profile',
          icon: User,
        },
      ],
    },
  ]
}

export function getAdminNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'admin',
      title: t('Admin'),
      items: [
        {
          title: t('Channels'),
          url: '/admin/channels',
          icon: Radio,
        },
        {
          title: t('Models'),
          url: '/admin/models/metadata',
          icon: Box,
        },
        {
          title: t('Users'),
          url: '/admin/users',
          icon: Users,
        },
        {
          title: t('Redemption Codes'),
          url: '/admin/redemption-codes',
          icon: Ticket,
        },
        {
          title: t('Subscription Management'),
          url: '/admin/subscriptions',
          icon: CreditCard,
        },
        {
          title: t('System Settings'),
          url: '/admin/system-settings/site',
          activeUrls: ['/admin/system-settings'],
          icon: Settings,
        },
      ],
    },
  ]
}

export function getChatNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'chat',
      title: t('Chat'),
      items: [
        {
          title: t('Chat Workspace'),
          url: PLATFORM_ROUTES.chat,
          icon: MessageSquare,
        },
        {
          title: t('API Console'),
          url: PLATFORM_ROUTES.console,
          icon: Key,
        },
      ],
    },
  ]
}

