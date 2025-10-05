import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { defaultTopNavLinks } from '../config/top-nav.config'
import { type TopNavLink } from '../types'
import { Header } from './header'
import { TopNav } from './top-nav'

/**
 * 通用的应用程序 Header 组件
 * 集成了导航栏、搜索、主题切换、配置和个人信息等功能
 *
 * @example
 * // 基础用法
 * <AppHeader />
 *
 * @example
 * // 自定义导航链接
 * <AppHeader navLinks={customLinks} />
 *
 * @example
 * // 不显示导航栏和搜索框
 * <AppHeader showTopNav={false} showSearch={false} />
 *
 * @example
 * // 固定在顶部
 * <AppHeader fixed />
 *
 * @example
 * // 完全自定义左侧和右侧内容
 * <AppHeader
 *   leftContent={<CustomLeft />}
 *   rightContent={<CustomRight />}
 * />
 */
type AppHeaderProps = {
  /**
   * 自定义导航链接，不提供则使用默认全局导航或从后端动态生成
   */
  navLinks?: TopNavLink[]
  /**
   * 是否显示顶部导航栏
   * @default true
   */
  showTopNav?: boolean
  /**
   * 左侧内容，如果提供则覆盖 TopNav
   */
  leftContent?: React.ReactNode
  /**
   * 是否显示搜索框
   * @default true
   */
  showSearch?: boolean
  /**
   * 是否固定在顶部
   * @default false
   */
  fixed?: boolean
  /**
   * 自定义右侧内容，如果提供则覆盖默认的右侧内容
   */
  rightContent?: React.ReactNode
  /**
   * 是否显示主题切换
   * @default true
   */
  showThemeSwitch?: boolean
  /**
   * 是否显示配置抽屉
   * @default true
   */
  showConfigDrawer?: boolean
  /**
   * 是否显示个人信息下拉
   * @default true
   */
  showProfileDropdown?: boolean
}

export function AppHeader({
  navLinks = defaultTopNavLinks,
  showTopNav = true,
  leftContent,
  showSearch = true,
  fixed = false,
  rightContent,
  showThemeSwitch = true,
  showConfigDrawer = true,
  showProfileDropdown = true,
}: AppHeaderProps) {
  // 优先使用从后端生成的动态链接
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  // 决定左侧内容：自定义内容 > 导航栏 > null
  const leftSection =
    leftContent || (showTopNav ? <TopNav links={links} /> : null)

  return (
    <Header fixed={fixed}>
      {leftSection}
      {rightContent ?? (
        <div className='ms-auto flex items-center space-x-4'>
          {showSearch && <Search />}
          {showThemeSwitch && <ThemeSwitch />}
          {showConfigDrawer && <ConfigDrawer />}
          {showProfileDropdown && <ProfileDropdown />}
        </div>
      )}
    </Header>
  )
}
