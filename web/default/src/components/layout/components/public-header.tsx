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
import { useState, useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationButton } from '@/components/notification-button'
import { NotificationDialog } from '@/components/notification-dialog'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'

export interface PublicHeaderProps {
  navLinks?: TopNavLink[]
  mobileLinks?: TopNavLink[]
  navContent?: React.ReactNode
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showNavigation?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  className?: string
}

export function PublicHeader(props: PublicHeaderProps) {
  const {
    navLinks = defaultTopNavLinks,
    // DeepRouter: theme switcher hidden by default until the .dark palette
    // is retuned to match the warm cream brand. Re-enable per-route by
    // passing showThemeSwitch={true} on <PublicLayout> or <PublicHeader>.
    showThemeSwitch = false,
    showLanguageSwitcher = true,
    logo: customLogo,
    siteName: customSiteName,
    homeUrl = '/',
    showAuthButtons = true,
    showNotifications = true,
  } = props

  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const { status } = useStatus()
  const dynamicLinks = useTopNavLinks()
  const notifications = useNotifications()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const user = auth.user
  const isAuthenticated = !!user
  const registerEnabled =
    status?.register_enabled ?? status?.data?.register_enabled ?? true
  const displaySiteName = customSiteName || systemName || 'DeepRouter'
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks
  // Brand mark renders as [icon] + [name text]. The name is real text — never a
  // baked-in wordmark image — so it survives any admin-configured logo and is
  // themeable / translatable. Falls back to the bundled icon when unset.
  const brandLogoSrc = systemLogo || '/logo.png'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      <header className='pointer-events-none fixed inset-x-0 top-0 z-50'>
        <div
          className={cn(
            'pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            scrolled ? 'max-w-[52rem] px-3 pt-3' : 'max-w-7xl px-4 pt-0 md:px-6'
          )}
        >
          <nav
            className={cn(
              'flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
              scrolled
                ? 'bg-card/80 ring-border h-12 rounded-xl pr-1.5 pl-4 shadow-[0_12px_34px_rgb(28_28_28/0.08)] ring-1 backdrop-blur-2xl dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,0.4)]'
                : 'h-16 px-2'
            )}
          >
            {/* Brand: icon + wordmark as independent elements so the name
                always renders, regardless of the configured logo. */}
            <Link
              to={homeUrl}
              aria-label={displaySiteName}
              className='group flex h-11 shrink-0 items-center gap-2.5'
            >
              {loading ? (
                <>
                  <Skeleton className='h-9 w-9 rounded-lg' />
                  <Skeleton className='h-5 w-28 rounded-md' />
                </>
              ) : customLogo ? (
                customLogo
              ) : (
                <>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-[1.05]'>
                    <HeaderLogo
                      src={brandLogoSrc}
                      loading={loading}
                      logoLoaded={logoLoaded}
                      alt={displaySiteName}
                      className='h-full w-full rounded-lg object-contain'
                    />
                  </div>
                  <span className='text-foreground max-w-[12rem] truncate text-lg font-semibold tracking-tight'>
                    {displaySiteName}
                  </span>
                </>
              )}
            </Link>

            {/* Desktop nav */}
            <div className='hidden items-center gap-0.5 sm:flex'>
              {links.map((link, i) => {
                const isActive = pathname === link.href
                if (link.external) {
                  return (
                    <a
                      key={i}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-muted-foreground hover:text-foreground rounded-[7px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200'
                    >
                      {t(link.title)}
                    </a>
                  )
                }
                return (
                  <Link
                    key={i}
                    to={link.href}
                    className={cn(
                      'rounded-[7px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200',
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(link.title)}
                  </Link>
                )
              })}

              {(showLanguageSwitcher ||
                showThemeSwitch ||
                showNotifications) && (
                <div className='bg-border/40 mx-2 h-4 w-px' />
              )}

              {showLanguageSwitcher && <LanguageSwitcher />}
              {showThemeSwitch && <ThemeSwitch />}
              {showNotifications && (
                <NotificationButton
                  unreadCount={notifications.unreadCount}
                  onClick={() => notifications.openDialog()}
                />
              )}

              {showAuthButtons && (
                <>
                  <div className='bg-border/40 mx-1 h-4 w-px' />
                  {loading ? (
                    <Skeleton className='h-8 w-20 rounded-[7px]' />
                  ) : isAuthenticated ? (
                    <ProfileDropdown />
                  ) : (
                    <div className='flex items-center gap-1.5'>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-8 px-3 text-xs font-medium'
                        render={<Link to='/sign-in' />}
                      >
                        {t('Sign in')}
                      </Button>
                      {registerEnabled && (
                        <Button
                          size='sm'
                          className='h-8 px-3.5 text-xs font-semibold'
                          render={<Link to='/sign-up' />}
                        >
                          {t('Sign up')}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile: compact actions + hamburger */}
            <div className='flex items-center gap-2 sm:hidden'>
              {showThemeSwitch && <ThemeSwitch />}
              {showAuthButtons && !loading && isAuthenticated && (
                <ProfileDropdown />
              )}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-9'
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={t('Toggle navigation menu')}
              >
                <div className='relative size-4'>
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] rotate-45' : 'top-[3px]'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'scale-x-0 opacity-0' : 'opacity-100'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] -rotate-45' : 'top-[11px]'
                    )}
                  />
                </div>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        className={cn(
          'bg-background/98 fixed inset-0 z-40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:pointer-events-none sm:hidden',
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      >
        <div className='flex h-full flex-col justify-between px-8 pt-20 pb-10'>
          <nav className='flex flex-col gap-1'>
            {links.map((link, i) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={i}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    mobileOpen
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-4 opacity-0',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  style={{
                    transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms',
                  }}
                >
                  {t(link.title)}
                </Link>
              )
            })}
          </nav>

          <div
            className={cn(
              'flex flex-col gap-3 transition-all duration-500',
              mobileOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-4 opacity-0'
            )}
            style={{ transitionDelay: mobileOpen ? '250ms' : '0ms' }}
          >
            {showAuthButtons &&
              (isAuthenticated ? (
                <Link
                  to='/dashboard'
                  onClick={() => setMobileOpen(false)}
                  className='bg-foreground text-background inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80'
                >
                  {t('Go to Dashboard')}
                </Link>
              ) : (
                <>
                  {registerEnabled && (
                    <Link
                      to='/sign-up'
                      onClick={() => setMobileOpen(false)}
                      className='bg-foreground text-background inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80'
                    >
                      {t('Sign up')}
                    </Link>
                  )}
                  <Link
                    to='/sign-in'
                    onClick={() => setMobileOpen(false)}
                    className='border-border bg-background text-foreground inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors hover:bg-muted/60'
                  >
                    {t('Sign in')}
                  </Link>
                </>
              ))}
          </div>
        </div>
      </div>

      {/* Notification Dialog */}
      {showNotifications && (
        <NotificationDialog
          open={notifications.dialogOpen}
          onOpenChange={notifications.setDialogOpen}
          activeTab={notifications.activeTab}
          onTabChange={notifications.setActiveTab}
          notice={notifications.notice}
          announcements={notifications.announcements}
          loading={notifications.loading}
          onCloseToday={notifications.closeToday}
        />
      )}
    </>
  )
}
