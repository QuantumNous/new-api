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

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

/**
 * Sundowner 公开导航：精简为 3 项（模型价格 / 排行榜 / 关于）。
 * 删除 Home / Console / Docs / About 等上游默认项。
 * 导航不再受 HeaderNavModules 后端配置控制，固定渲染。
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()

  return [
    { title: t('Pricing'), href: '/pricing' },
    { title: t('Rankings'), href: '/rankings' },
  ]
}
