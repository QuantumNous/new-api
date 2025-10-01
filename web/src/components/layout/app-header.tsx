import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { defaultTopNavLinks } from './data/top-nav-data'
import { Header } from './header'
import { TopNav } from './top-nav'

/**
 * 通用的应用程序 Header 组件
 *
 * @example
 * // 基础用法 - 默认包含全局导航、搜索、主题切换、配置和个人信息
 * <AppHeader />
 *
 * @example
 * // 自定义导航链接
 * <AppHeader navLinks={customLinks} />
 *
 * @example
 * // 不显示导航栏
 * <AppHeader showTopNav={false} />
 *
 * @example
 * // 固定在顶部，不显示搜索框
 * <AppHeader fixed showSearch={false} />
 *
 * @example
 * // 完全自定义左侧内容
 * <AppHeader leftContent={<CustomComponent />} />
 */
type AppHeaderProps = {
  /**
   * 自定义导航链接，不提供则使用默认全局导航
   */
  navLinks?: {
    title: string
    href: string
    isActive: boolean
    disabled?: boolean
  }[]
  /**
   * 是否显示顶部导航栏，默认 true
   */
  showTopNav?: boolean
  /**
   * 左侧内容，如果提供则覆盖 TopNav
   */
  leftContent?: React.ReactNode
  /**
   * 是否显示搜索框，默认 true
   */
  showSearch?: boolean
  /**
   * 是否固定在顶部，默认 false
   */
  fixed?: boolean
  /**
   * 自定义右侧内容，如果提供则覆盖默认的右侧内容
   */
  rightContent?: React.ReactNode
  /**
   * 是否显示主题切换，默认 true
   */
  showThemeSwitch?: boolean
  /**
   * 是否显示配置抽屉，默认 true
   */
  showConfigDrawer?: boolean
  /**
   * 是否显示个人信息下拉，默认 true
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
  // 从后端状态生成的链接
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks
  // 如果提供了 leftContent，使用它；否则根据 showTopNav 决定是否显示导航
  const leftSection =
    leftContent || (showTopNav ? <TopNav links={links} /> : null)

  return (
    <Header fixed={fixed}>
      {leftSection}
      {rightContent ? (
        rightContent
      ) : (
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
