import { sidebarConfig } from '../config/sidebar.config'
import { systemSettingsConfig } from '../config/system-settings.config'
import type { NavGroup } from '../types'

/**
 * 工作区配置类型
 * 每个工作区包含名称、路径匹配规则和对应的导航组配置
 */
export type WorkspaceConfig = {
  /** 工作区名称 */
  name: string
  /** 路径匹配规则，支持字符串（包含匹配）或正则表达式 */
  pathPattern: string | RegExp
  /** 该工作区对应的侧边栏导航组配置 */
  navGroups: NavGroup[]
}

/**
 * 工作区注册表
 *
 * 按优先级排序，第一个匹配的工作区将被使用
 * 最后一个应该是默认工作区（匹配所有路径）
 *
 * @example
 * // 添加新工作区
 * {
 *   name: 'User Management',
 *   pathPattern: /^\/user-management/,
 *   navGroups: userManagementConfig
 * }
 */
const workspaceRegistry: WorkspaceConfig[] = [
  // System Settings 工作区
  {
    name: 'System Settings',
    pathPattern: /^\/system-settings/,
    navGroups: systemSettingsConfig,
  },
  // 默认工作区（必须放在最后）
  {
    name: 'Default',
    pathPattern: /.*/,
    navGroups: sidebarConfig.navGroups,
  },
]

/**
 * 根据路径获取匹配的工作区配置
 * @param pathname - 当前路由路径
 * @returns 匹配的工作区配置
 */
export function getWorkspaceByPath(pathname: string): WorkspaceConfig {
  const workspace = workspaceRegistry.find((ws) => {
    if (typeof ws.pathPattern === 'string') {
      return pathname.includes(ws.pathPattern)
    }
    return ws.pathPattern.test(pathname)
  })

  // 如果没有匹配，返回默认工作区（最后一个）
  return workspace || workspaceRegistry[workspaceRegistry.length - 1]
}

/**
 * 根据路径获取对应的侧边栏导航组配置
 * @param pathname - 当前路由路径
 * @returns 对应工作区的导航组配置
 */
export function getNavGroupsForPath(pathname: string): NavGroup[] {
  return getWorkspaceByPath(pathname).navGroups
}

/**
 * 判断是否在指定工作区
 * @param pathname - 当前路由路径
 * @param workspaceName - 工作区名称
 * @returns 是否在指定工作区
 */
export function isInWorkspace(
  pathname: string,
  workspaceName: string
): boolean {
  return getWorkspaceByPath(pathname).name === workspaceName
}

/**
 * 获取所有注册的工作区配置
 * @returns 工作区配置数组
 */
export function getAllWorkspaces(): WorkspaceConfig[] {
  return workspaceRegistry
}
