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

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { BuiltinModulesRegistry } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'
import { type TopNavLink } from '@/components/layout/types'

/**
 * 动态加载并拼装顶部导航树 Hook
 */
export function useTopNavLinks(): TopNavLink[] {
  const { i18n } = useTranslation()
  const { auth } = useAuthStore()

  // 区分 i18n 语言环境
  const currentLang = i18n.language || 'zh-CN'

  // 利用 React Query 获取可见的菜单树
  const { data: rawTree } = useQuery<any[]>({
    queryKey: ['navigation-tree', 'default_web_top', currentLang, auth?.user?.id],
    queryFn: async () => {
      const res = await api.get('/api/navigation/tree', {
        params: {
          menu_key: 'default_web_top',
          lang: currentLang,
        },
        skipErrorHandler: true, // 避免加载失败弹窗影响全局交互，实施静默重试/加载
      })
      return res.data?.data || []
    },
  })

  // 将后端动态返回的菜单节点转换为前端标准的顶级及多级嵌套路由格式
  const links: TopNavLink[] = (rawTree || []).map(mapNavigationItemToLink)

  return links
}

/**
 * 映射后端 DTO 格式节点到前端导航项
 */
function mapNavigationItemToLink(item: any): TopNavLink {
  let href = ''
  let isExternal = false

  switch (item.type) {
    case 'builtin_module':
      // 引用内置注册表的 SPA 路径
      const meta = BuiltinModulesRegistry[item.module_key]
      href = meta ? meta.to : '/'
      break
    case 'internal_path':
      href = item.path || '/'
      break
    case 'external_url':
      href = item.url || ''
      isExternal = true
      break
    case 'group':
      href = '#'
      break
    default:
      href = '#'
  }

  // 递归转换子菜单节点
  const children =
    item.children && item.children.length > 0
      ? item.children.map(mapNavigationItemToLink)
      : undefined

  return {
    title: item.label,
    href,
    external: isExternal,
    openInNewTab: item.open_in_new_tab,
    children,
  }
}
