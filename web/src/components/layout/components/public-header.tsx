import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { SKELETON_DEFAULTS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SkeletonWrapper } from '@/components/skeleton-wrapper'
import { ThemeSwitch } from '@/components/theme-switch'
import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'
import { NavLinkList } from './nav-link-item'
import { Navbar, NavbarLeft, NavbarRight } from './navbar'

export interface PublicHeaderProps {
  /**
   * Custom navigation links - if not provided, will use dynamic links from backend or defaultTopNavLinks
   * Similar to AppHeader behavior
   */
  navLinks?: TopNavLink[]
  /**
   * Custom navigation links for mobile
   * Falls back to navLinks if not provided
   */
  mobileLinks?: TopNavLink[]
  /**
   * Custom navigation content (displayed after logo)
   */
  navContent?: React.ReactNode
  /**
   * Show theme switcher
   * @default true
   */
  showThemeSwitch?: boolean
  /**
   * Custom logo component (overrides system logo from backend)
   * @default undefined - uses logo from backend
   */
  logo?: React.ReactNode
  /**
   * Custom site name displayed next to logo (overrides system name from backend)
   * @default undefined - uses system name from backend
   */
  siteName?: string
  /**
   * Home URL for logo link
   * @default '/'
   */
  homeUrl?: string
  /**
   * Custom left content - if provided, overrides logo and navigation
   */
  leftContent?: React.ReactNode
  /**
   * Custom right content - if provided, overrides auth buttons and theme switch
   */
  rightContent?: React.ReactNode
  /**
   * Show navigation links
   * @default true
   */
  showNavigation?: boolean
  /**
   * Show auth buttons (Sign In/Get Started or Dashboard)
   * @default true
   */
  showAuthButtons?: boolean
  /**
   * Additional className for header
   */
  className?: string
}

/**
 * Public header component for non-console pages
 * Provides a consistent header with navigation, auth buttons, and mobile menu
 * Uses the same navigation logic as AppHeader:
 * 1. Priority: Dynamic links from backend > provided navLinks > defaultTopNavLinks
 *
 * @example
 * // Basic usage - will use dynamic links or defaults
 * <PublicHeader />
 *
 * @example
 * // Custom navigation links
 * <PublicHeader
 *   navLinks={[
 *     { title: 'Features', href: '/features' },
 *     { title: 'About', href: '/about' }
 *   ]}
 * />
 *
 * @example
 * // Hide certain elements
 * <PublicHeader
 *   showThemeSwitch={false}
 *   showAuthButtons={false}
 * />
 *
 * @example
 * // Fully custom content
 * <PublicHeader
 *   leftContent={<CustomLogo />}
 *   rightContent={<CustomActions />}
 * />
 */
export function PublicHeader({
  navLinks = defaultTopNavLinks,
  mobileLinks,
  navContent,
  showThemeSwitch = true,
  logo: customLogo,
  siteName: customSiteName,
  homeUrl = '/',
  leftContent,
  rightContent,
  showNavigation = true,
  showAuthButtons = true,
  className,
}: PublicHeaderProps) {
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  // Get system configuration from backend
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()

  // Use custom props if provided, otherwise use system config
  const displayLogo = customLogo || (
    <HeaderLogo src={systemLogo} loading={loading} logoLoaded={logoLoaded} />
  )
  const displaySiteName = customSiteName || systemName

  // Use the same logic as AppHeader: prioritize dynamic links from backend
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks
  const mobileLinksList = mobileLinks || links

  return (
    <header className={cn('sticky top-0 z-50 -mb-4 px-4 pb-4', className)}>
      <div className='fade-bottom bg-background/15 absolute left-0 h-24 w-full backdrop-blur-lg'></div>
      <div className='max-w-container relative mx-auto'>
        <Navbar>
          {/* Left section: Logo + Navigation */}
          <NavbarLeft>
            {leftContent || (
              <>
                <Link
                  to={homeUrl}
                  className='flex items-center gap-2 text-xl font-bold'
                >
                  {/* Logo with skeleton */}
                  <div className='relative h-6 w-6'>
                    <SkeletonWrapper
                      loading={loading || !logoLoaded}
                      type='image'
                    />
                    {displayLogo}
                  </div>
                  {/* System name with skeleton */}
                  <SkeletonWrapper
                    loading={loading}
                    type='title'
                    width={SKELETON_DEFAULTS.TITLE_WIDTH}
                    height={SKELETON_DEFAULTS.TITLE_HEIGHT}
                  >
                    {displaySiteName}
                  </SkeletonWrapper>
                </Link>
                {/* Desktop Navigation */}
                {showNavigation &&
                  (loading ? (
                    <SkeletonWrapper
                      loading={true}
                      type='navigation'
                      count={SKELETON_DEFAULTS.NAV_COUNT}
                      width={SKELETON_DEFAULTS.NAV_WIDTH}
                      height={SKELETON_DEFAULTS.NAV_HEIGHT}
                    />
                  ) : (
                    navContent
                  ))}
              </>
            )}
          </NavbarLeft>

          {/* Right section: Auth + Theme switch + Mobile menu */}
          <NavbarRight>
            {rightContent || (
              <>
                {showThemeSwitch && <ThemeSwitch />}
                {showAuthButtons && (
                  // Fixed container to maintain consistent size
                  <div className='hidden h-9 items-center md:flex'>
                    {loading ? (
                      // Skeleton while system config is loading
                      <Skeleton className='h-9 w-9 rounded-full' />
                    ) : isAuthenticated ? (
                      // User profile dropdown when authenticated
                      <ProfileDropdown />
                    ) : (
                      // Sign in button when not authenticated
                      <Button variant='ghost' size='sm' asChild className='h-9'>
                        <Link to='/sign-in'>Sign in</Link>
                      </Button>
                    )}
                  </div>
                )}

                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='shrink-0 md:hidden'
                    >
                      <Menu className='size-5' />
                      <span className='sr-only'>Toggle navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side='right'>
                    <nav className='grid gap-6 text-lg font-medium'>
                      {/* Mobile menu title */}
                      <Link
                        to={homeUrl}
                        className='flex items-center gap-2 text-xl font-bold'
                      >
                        <SkeletonWrapper
                          loading={loading}
                          type='title'
                          width={SKELETON_DEFAULTS.TITLE_WIDTH}
                          height={SKELETON_DEFAULTS.TITLE_HEIGHT}
                        >
                          <span>{displaySiteName}</span>
                        </SkeletonWrapper>
                      </Link>
                      {/* Mobile navigation links */}
                      {loading ? (
                        <SkeletonWrapper
                          loading={true}
                          type='navigation'
                          count={SKELETON_DEFAULTS.MOBILE_NAV_COUNT}
                          width={SKELETON_DEFAULTS.MOBILE_NAV_WIDTH}
                          height={SKELETON_DEFAULTS.MOBILE_NAV_HEIGHT}
                        />
                      ) : (
                        <NavLinkList links={mobileLinksList} />
                      )}
                      {showAuthButtons && !loading && (
                        <Link
                          to={isAuthenticated ? '/dashboard' : '/sign-in'}
                          className='text-muted-foreground hover:text-foreground'
                        >
                          {isAuthenticated ? 'Dashboard' : 'Sign in'}
                        </Link>
                      )}
                    </nav>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </NavbarRight>
        </Navbar>
      </div>
    </header>
  )
}
