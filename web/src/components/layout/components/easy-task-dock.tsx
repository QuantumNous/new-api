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
import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const EASY_TASKS = [
  {
    titleKey: 'Overview',
    to: '/dashboard',
    icon: LayoutDashboard,
    tone: 'leaf',
  },
  { titleKey: 'My key', to: '/keys', icon: KeyRound, tone: 'model' },
  {
    titleKey: 'Model prices',
    to: '/pricing',
    icon: Sparkles,
    tone: 'money',
  },
  { titleKey: 'Beginner guide', to: '/guide', icon: BookOpen, tone: 'signal' },
  {
    titleKey: 'Spending details',
    to: '/usage-logs',
    icon: ReceiptText,
    tone: 'money',
  },
  { titleKey: 'Wallet', to: '/wallet', icon: Wallet, tone: 'leaf' },
] as const

export function EasyTaskDock() {
  const { t } = useTranslation()

  return (
    <nav className='dopa-easy-task-dock' aria-label={t('Easy mode')}>
      {EASY_TASKS.map((item) => {
        const Icon = item.icon

        return (
          <Link
            key={item.to}
            to={item.to}
            className='dopa-easy-task-link'
            data-tone={item.tone}
          >
            <Icon className='size-3.5 shrink-0' aria-hidden='true' />
            <span>{t(item.titleKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
