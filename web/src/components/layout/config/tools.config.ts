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
  Globe,
  Mail,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'

import type { NavGroup, SidebarView } from '../types'

function getToolsNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'account-tools',
      title: t('Account Tools'),
      items: [
        {
          title: t('OpenAI Pool V6'),
          url: '/tools/openai-pool',
          icon: Workflow,
        },
        {
          title: t('Codex Register'),
          url: '/tools/codex-register',
          icon: Zap,
        },
        {
          title: t('GPT + DuckMail'),
          url: '/tools/gpt-duckmail',
          icon: Users,
        },
        {
          title: t('Team All-in-One'),
          url: '/tools/team-all-in-one',
          icon: Box,
        },
        {
          title: t('OB-1 Gateway'),
          url: '/tools/ob1-gateway',
          icon: Box,
        },
      ],
    },
    {
      id: 'mail-tools',
      title: t('Mail Tools'),
      items: [
        {
          title: t('Mail Forge'),
          url: '/tools/mail-forge',
          icon: Mail,
        },
        {
          title: t('Cloud Mail'),
          url: '/tools/cloud-mail',
          icon: Globe,
        },
      ],
    },
  ]
}

export const TOOLS_VIEW: SidebarView = {
  id: 'tools',
  pathPattern: /^\/tools(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: getToolsNavGroups,
}
