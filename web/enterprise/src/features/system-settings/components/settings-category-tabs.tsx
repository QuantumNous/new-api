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
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const SETTINGS_CATEGORIES = [
  { id: 'auth', labelKey: 'Authentication', path: '/system-settings/auth' },
  { id: 'site', labelKey: 'Site', path: '/system-settings/site' },
  { id: 'billing', labelKey: 'Billing', path: '/system-settings/billing' },
  { id: 'models', labelKey: 'Models', path: '/system-settings/models' },
  {
    id: 'content',
    labelKey: 'Content',
    path: '/system-settings/content',
  },
  {
    id: 'operations',
    labelKey: 'Operations',
    path: '/system-settings/operations',
  },
  {
    id: 'security',
    labelKey: 'Security',
    path: '/system-settings/security',
  },
] as const

export function SettingsCategoryTabs() {
  const { t } = useTranslation()
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div className='flex flex-wrap gap-1 mb-5'>
      {SETTINGS_CATEGORIES.map((category) => {
        const isActive = currentPath.startsWith(category.path)
        return (
          <Link
            key={category.id}
            to={category.path}
            className={cn(
              'px-3.5 py-1.5 rounded-[6px] text-sm font-medium transition-all',
              'border border-transparent',
              isActive
                ? 'bg-primary/10 text-primary border-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {t(category.labelKey)}
          </Link>
        )
      })}
    </div>
  )
}
