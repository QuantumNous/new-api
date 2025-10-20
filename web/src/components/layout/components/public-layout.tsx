import type { TopNavLink } from '../types'
import { PublicHeader, type PublicHeaderProps } from './public-header'
import { PublicNavigation } from './public-navigation'

type PublicLayoutProps = {
  children: React.ReactNode
  /**
   * Whether to show main container wrapper
   * @default true
   */
  showMainContainer?: boolean
  /**
   * Custom navigation content (displayed after logo)
   */
  navContent?: React.ReactNode
  /**
   * Header configuration - all props from PublicHeader
   */
  headerProps?: Omit<PublicHeaderProps, 'navContent'>
  /**
   * Custom navigation links - if not provided, will use dynamic links from backend or defaults
   */
  navLinks?: TopNavLink[]
  /**
   * Show theme switcher in header
   * @default true
   */
  showThemeSwitch?: boolean
  /**
   * Show auth buttons in header
   * @default true
   */
  showAuthButtons?: boolean
  /**
   * Show notification button in header
   * @default true
   */
  showNotifications?: boolean
  /**
   * Custom logo component
   */
  logo?: React.ReactNode
  /**
   * Site name
   */
  siteName?: string
}

/**
 * Public page layout component
 * Used for non-console pages (pricing, about, home, etc.)
 * Provides unified header and layout structure
 *
 * @example
 * // Basic usage
 * <PublicLayout>
 *   <HomePage />
 * </PublicLayout>
 *
 * @example
 * // Custom navigation
 * <PublicLayout
 *   navLinks={[
 *     { title: 'Features', href: '/features' },
 *     { title: 'Pricing', href: '/pricing' },
 *     { title: 'Blog', href: '/blog', external: true }
 *   ]}
 * >
 *   <Content />
 * </PublicLayout>
 *
 * @example
 * // Without main container
 * <PublicLayout showMainContainer={false}>
 *   <HeroSection />
 *   <Features />
 * </PublicLayout>
 */
export function PublicLayout({
  children,
  showMainContainer = true,
  navContent,
  headerProps,
  navLinks,
  showThemeSwitch = true,
  showAuthButtons = true,
  showNotifications = true,
  logo,
  siteName,
}: PublicLayoutProps) {
  // Use PublicNavigation as default if no navContent provided
  const navigationContent = navContent || <PublicNavigation links={navLinks} />

  return (
    <div className='min-h-screen'>
      <PublicHeader
        navContent={navigationContent}
        navLinks={navLinks}
        showThemeSwitch={showThemeSwitch}
        showAuthButtons={showAuthButtons}
        showNotifications={showNotifications}
        logo={logo}
        siteName={siteName}
        {...headerProps}
      />

      {showMainContainer ? (
        <main className='container px-4 py-6 md:px-4'>{children}</main>
      ) : (
        children
      )}
    </div>
  )
}
