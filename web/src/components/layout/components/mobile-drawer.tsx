import { Link } from '@tanstack/react-router'
import { X, User, Wallet, LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { AuthUser } from '@/stores/auth-store'
import { SKELETON_DEFAULTS } from '@/lib/constants'
import useDialogState from '@/hooks/use-dialog'
import { useUserDisplay } from '@/hooks/use-user-display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { SkeletonWrapper } from '@/components/skeleton-wrapper'
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
        <div className='border-border flex items-center gap-2.5 border-b p-2.5'>
          <Avatar className='size-9'>
            <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
            <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-col gap-0.5 overflow-hidden'>
            <p className='text-foreground truncate font-medium'>
              {displayName}
            </p>
            <div className='flex items-center gap-1.5'>
              <span className='text-muted-foreground text-xs'>{roleLabel}</span>
              {user.group && (
                <>
                  <span className='text-muted-foreground text-xs'>·</span>
                  <span className='text-muted-foreground text-xs'>
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
          className='text-primary/60 hover:text-primary/80 border-border flex items-center gap-2.5 border-b p-2.5 transition-colors'
        >
          <User className='size-4' />
          {t('Profile')}
        </Link>

        <Link
          to='/wallet'
          onClick={onNavigate}
          className='text-primary/60 hover:text-primary/80 border-border flex items-center gap-2.5 border-b p-2.5 transition-colors'
        >
          <Wallet className='size-4' />
          {t('Wallet')}
        </Link>

        {/* Sign out - consistent style */}
        <button
          onClick={() => setSignOutOpen(true)}
          className='text-destructive hover:text-destructive/80 flex items-center gap-2.5 p-2.5 transition-colors'
        >
          <LogOut className='size-4' />
          {t('Sign out')}
        </button>
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
    <Button variant='secondary' size='sm' asChild className='h-10 w-full'>
      <Link to='/sign-in' onClick={onNavigate}>
        {t('Sign in')}
      </Link>
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
            className={MOBILE_DRAWER_CONFIG.overlayClassName}
            initial='hidden'
            animate='visible'
            exit='exit'
            variants={MOBILE_DRAWER_ANIMATION.overlay as any}
            transition={{
              duration: MOBILE_DRAWER_CONFIG.overlayTransitionDuration,
            }}
            onClick={onClose}
          />

          {/* Drawer Content */}
          <motion.div
            className={MOBILE_DRAWER_CONFIG.drawerClassName}
            initial='hidden'
            animate='visible'
            exit='exit'
            variants={MOBILE_DRAWER_ANIMATION.drawer as any}
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
                <button
                  onClick={onClose}
                  className='hover:text-primary cursor-pointer rounded-md p-1'
                  aria-label={t('Close menu')}
                >
                  <X className='size-5' />
                </button>
              </div>

              {/* Navigation links */}
              <motion.div
                className='border-border mb-4 flex flex-col rounded-md border text-sm'
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              >
                {loading ? (
                  <SkeletonWrapper
                    loading={true}
                    type='navigation'
                    count={SKELETON_DEFAULTS.MOBILE_NAV_COUNT}
                    width={SKELETON_DEFAULTS.MOBILE_NAV_WIDTH}
                    height={SKELETON_DEFAULTS.MOBILE_NAV_HEIGHT}
                  />
                ) : (
                  <AnimatePresence>
                    {mobileLinksList.map((link, index) => (
                      <motion.div
                        key={`${link.href}-${index}`}
                        className='border-border border-b p-2.5 last:border-b-0'
                        variants={MOBILE_DRAWER_ANIMATION.menuItem as any}
                      >
                        <Link
                          to={link.href}
                          className='text-primary/60 hover:text-primary/80 transition-colors'
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
