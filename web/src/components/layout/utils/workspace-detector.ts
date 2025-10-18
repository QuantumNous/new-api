/**
 * 工作区检测工具
 * 根据当前 URL 路径判断用户应该在哪个工作区
 */

/**
 * 从当前 URL 检测工作区名称
 * @param pathname - 当前路由路径，默认使用 window.location.pathname
 * @returns 工作区名称：'System Settings' 或 null（表示主工作区）
 */
export function detectWorkspaceFromURL(pathname?: string): string | null {
  const path =
    pathname || (typeof window !== 'undefined' ? window.location.pathname : '')

  // 检查是否在系统设置路由中
  if (path.includes('/system-settings')) {
    return 'System Settings'
  }

  // 其他路由属于主工作区
  return null
}

/**
 * 判断是否应该显示 System Settings 导航
 * @param pathname - 当前路由路径
 * @returns 是否在 System Settings 工作区
 */
export function isSystemSettingsPath(pathname?: string): boolean {
  return detectWorkspaceFromURL(pathname) === 'System Settings'
}
