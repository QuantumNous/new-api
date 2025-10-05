import { type TopNavLink } from '../types'

/**
 * 默认顶部导航配置
 * 可在 AppHeader 组件中覆盖
 */
export const defaultTopNavLinks: TopNavLink[] = [
  {
    title: 'Home',
    href: '/',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Console',
    href: '/console',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Models',
    href: '/models',
    isActive: false,
    disabled: false,
  },
  {
    title: 'About',
    href: '/about',
    isActive: false,
    disabled: false,
  },
]
