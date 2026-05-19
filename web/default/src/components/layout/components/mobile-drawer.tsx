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
import { Link } from '@tanstack/react-router'
import { X, User, Wallet, LogOut } from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { normalizeSystemName } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/stores/auth-store'
import useDialogState from '@/hooks/use-dialog'
import { useUserDisplay } from '@/hooks/use-user-display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { MOBILE_DRAWER_ANIMATION, MOBILE_DRAWER_CONFIG } from '../constants'
import type { TopNavLink } from '../types'

/**
 * Brand logo component with skeleton loading
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
  const brandName = normalizeSystemName(displaySiteName)

  return (
    <Link
      to={homeUrl}
      className='flex items-center gap-2 text-lg font-semibold text-slate-50'
      onClick={onClick}
    >
      <div className='relative h-6 w-6'>
        {loading || !logoLoaded ? (
          <Skeleton className='absolute inset-0 rounded-full' />
        ) : null}
        {displayLogo}
      </div>
      {loading ? (
        <Skeleton className='h-5 w-40 bg-white/10' />
      ) : (
        <span className='line-clamp-2 leading-snug'>{brandName}</span>
      )}
    </Link>
  )
}

/**
 * Mobile user profile section with navigation links
 */
interface MobileUserProfileProps {
  user: AuthUser | null
  onNavigate?: () => void
}

function MobileUserProfile({ user, onNavigate }: MobileUserProfileProps) {
  const { t } = useTranslation()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const { displayName, initials, roleLabel } = useUserDisplay(user)

  if (!user) return null

  return (
    <>
      {/* User info section - compact style matching navigation */}
      <div className='flex flex-col text-sm'>
        {/* User header - simplified */}
        <div className='flex items-center gap-2.5 border-b border-white/10 p-2.5'>
          <Avatar className='size-9'>
            <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
            <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-col gap-0.5 overflow-hidden'>
            <p className='truncate font-medium text-slate-50'>{displayName}</p>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs text-slate-400'>{roleLabel}</span>
              {user.group && (
                <>
                  <span className='text-xs text-slate-500'>·</span>
                  <span className='text-xs text-slate-400'>
                    {String(user.group)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation links - same style as top nav */}
        <Link
          to='/profile'
          onClick={onNavigate}
          className='flex items-center gap-2.5 border-b border-white/10 p-2.5 text-slate-200 transition-colors hover:bg-white/5 hover:text-indigo-200'
        >
          <User className='size-4' />
          {t('Account Profile')}
        </Link>

        <Link
          to='/wallet'
          onClick={onNavigate}
          className='flex items-center gap-2.5 border-b border-white/10 p-2.5 text-slate-200 transition-colors hover:bg-white/5 hover:text-indigo-200'
        >
          <Wallet className='size-4' />
          {t('Token Quota Management')}
        </Link>

        {/* Sign out - consistent style */}
        <Button
          variant='ghost'
          onClick={() => setSignOutOpen(true)}
          className='text-destructive hover:bg-destructive/10 hover:text-destructive h-auto w-full justify-start gap-2.5 p-2.5'
        >
          <LogOut className='size-4' />
          {t('Sign out')}
        </Button>
      </div>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}

/**
 * Mobile sign in button for unauthenticated users
 */
interface MobileSignInButtonProps {
  onNavigate?: () => void
}

function MobileSignInButton({ onNavigate }: MobileSignInButtonProps) {
  const { t } = useTranslation()
  return (
    <Button
      variant='secondary'
      size='sm'
      className='h-10 w-full'
      render={<Link to='/sign-in' onClick={onNavigate} />}
    >
      {t('Sign in')}
    </Button>
  )
}

/**
 * Mobile drawer component props
 */
export interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  homeUrl: string
  displayLogo: React.ReactNode
  displaySiteName: string
  loading: boolean
  logoLoaded: boolean
  mobileLinksList: TopNavLink[]
  showAuthButtons: boolean
  user: AuthUser | null
}

/**
 * Mobile drawer component with bottom slide-up animation
 * Displays navigation links and user profile section
 */
export function MobileDrawer({
  isOpen,
  onClose,
  homeUrl,
  displayLogo,
  displaySiteName,
  loading,
  logoLoaded,
  mobileLinksList,
  showAuthButtons,
  user,
}: MobileDrawerProps) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className={cn(
              MOBILE_DRAWER_CONFIG.overlayClassName,
              'bg-slate-950/60 backdrop-blur-sm'
            )}
            initial='hidden'
            animate='visible'
            exit='exit'
            variants={MOBILE_DRAWER_ANIMATION.overlay as Variants}
            transition={{
              duration: MOBILE_DRAWER_CONFIG.overlayTransitionDuration,
            }}
            onClick={onClose}
          />

          {/* Drawer Content */}
          <motion.div
            className={cn(
              'fixed inset-x-0 bottom-3 z-50 mx-auto w-[95%] rounded-xl border border-white/10 p-4 shadow-2xl shadow-indigo-950/30 md:hidden',
              'bg-slate-950/95 text-slate-100 backdrop-blur-xl'
            )}
            initial='hidden'
            animate='visible'
            exit='exit'
            variants={MOBILE_DRAWER_ANIMATION.drawer as Variants}
          >
            <div className='flex flex-col gap-4'>
              {/* Header with logo and close button */}
              <div className='flex items-center justify-between'>
                <BrandLogo
                  homeUrl={homeUrl}
                  displayLogo={displayLogo}
                  displaySiteName={displaySiteName}
                  loading={loading}
                  logoLoaded={logoLoaded}
                  onClick={onClose}
                />
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={onClose}
                  className='hover:text-primary cursor-pointer'
                  aria-label={t('Close menu')}
                >
                  <X className='size-5' />
                </Button>
              </div>

              {/* Navigation links */}
              <motion.div
                className='mb-4 flex flex-col rounded-lg border border-white/10 bg-white/5 text-sm'
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              >
                {loading ? (
                  <div className='flex flex-col gap-1 p-2'>
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className='h-8 w-full' />
                    ))}
                  </div>
                ) : (
                  <AnimatePresence>
                    {mobileLinksList.map((link, index) => (
                      <motion.div
                        key={`${link.href}-${index}`}
                        className='border-b border-white/10 p-2.5 last:border-b-0'
                        variants={MOBILE_DRAWER_ANIMATION.menuItem as Variants}
                      >
                        <Link
                          to={link.href}
                          className='text-slate-200 transition-colors hover:text-indigo-200'
                          onClick={onClose}
                        >
                          {link.title}
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>

              {/* User profile section */}
              {showAuthButtons &&
                (user ? (
                  <MobileUserProfile user={user} onNavigate={onClose} />
                ) : (
                  <MobileSignInButton onNavigate={onClose} />
                ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
