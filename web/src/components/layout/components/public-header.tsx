import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { SKELETON_DEFAULTS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SkeletonWrapper } from '@/components/skeleton-wrapper'
import { ThemeSwitch } from '@/components/theme-switch'
import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'
import { MobileDrawer } from './mobile-drawer'
import { Navbar, NavbarLeft, NavbarRight } from './navbar'

/**
 * Brand logo component for header
 */
interface BrandLogoProps {
  homeUrl: string
  displayLogo: React.ReactNode
  displaySiteName: string
  loading: boolean
  logoLoaded: boolean
  onClick?: () => void
}

function BrandLogo({
  homeUrl,
  displayLogo,
  displaySiteName,
  loading,
  logoLoaded,
  onClick,
}: BrandLogoProps) {
  return (
    <Link
      to={homeUrl}
      className='flex items-center gap-2 text-xl font-bold'
      onClick={onClick}
    >
      <div className='relative h-6 w-6'>
        <SkeletonWrapper loading={loading || !logoLoaded} type='image' />
        {displayLogo}
      </div>
      <SkeletonWrapper
        loading={loading}
        type='title'
        width={SKELETON_DEFAULTS.TITLE_WIDTH}
        height={SKELETON_DEFAULTS.TITLE_HEIGHT}
      >
        {displaySiteName}
      </SkeletonWrapper>
    </Link>
  )
}

/**
 * Desktop authentication button
 */
interface DesktopAuthButtonProps {
  isAuthenticated: boolean
  loading: boolean
}

function DesktopAuthButton({
  isAuthenticated,
  loading,
}: DesktopAuthButtonProps) {
  return (
    <div className='hidden h-9 items-center md:flex'>
      {loading ? (
        <Skeleton className='h-9 w-9 rounded-full' />
      ) : isAuthenticated ? (
        <ProfileDropdown />
      ) : (
        <Button variant='ghost' size='sm' asChild className='h-9'>
          <Link to='/sign-in'>Sign in</Link>
        </Button>
      )}
    </div>
  )
}

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const dynamicLinks = useTopNavLinks()

  // Computed values
  const user = auth.user
  const isAuthenticated = !!user
  const displayLogo = customLogo || (
    <HeaderLogo src={systemLogo} loading={loading} logoLoaded={logoLoaded} />
  )
  const displaySiteName = customSiteName || systemName
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks
  const mobileLinksList = mobileLinks || links

  // Handlers
  const closeDrawer = () => setIsDrawerOpen(false)
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev)

  return (
    <header className={cn('sticky top-0 z-50 -mb-4 px-4 pb-4', className)}>
      <div className='fade-bottom bg-background/15 absolute left-0 h-24 w-full backdrop-blur-lg'></div>
      <div className='max-w-container relative mx-auto'>
        <Navbar>
          <NavbarLeft>
            {leftContent || (
              <>
                <BrandLogo
                  homeUrl={homeUrl}
                  displayLogo={displayLogo}
                  displaySiteName={displaySiteName}
                  loading={loading}
                  logoLoaded={logoLoaded}
                />
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

          <NavbarRight>
            {rightContent || (
              <>
                {showThemeSwitch && <ThemeSwitch />}
                {showAuthButtons && (
                  <DesktopAuthButton
                    isAuthenticated={isAuthenticated}
                    loading={loading}
                  />
                )}
                <Button
                  variant='ghost'
                  size='icon'
                  className='shrink-0 md:hidden'
                  onClick={toggleDrawer}
                >
                  {isDrawerOpen ? (
                    <X className='size-5' />
                  ) : (
                    <Menu className='size-5' />
                  )}
                  <span className='sr-only'>Toggle navigation menu</span>
                </Button>
              </>
            )}
          </NavbarRight>
        </Navbar>
      </div>

      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        homeUrl={homeUrl}
        displayLogo={displayLogo}
        displaySiteName={displaySiteName}
        loading={loading}
        logoLoaded={logoLoaded}
        mobileLinksList={mobileLinksList}
        showAuthButtons={showAuthButtons}
        user={user}
      />
    </header>
  )
}
