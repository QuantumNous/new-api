import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { User, Wallet, LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import useDialogState from '@/hooks/use-dialog'
import { useUserDisplay } from '@/hooks/use-user-display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const { t } = useTranslation()
  const [open, setOpen] = useDialogState()
  const [sheetOpen, setSheetOpen] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, initials, roleLabel } = useUserDisplay(user)
  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant='ghost' className='relative h-9 w-9 rounded-full p-0'>
            <Avatar className='h-9 w-9'>
              <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </SheetTrigger>
        <SheetContent
          side='right'
          className='flex w-full flex-col p-0 sm:max-w-sm'
        >
          <SheetHeader className='border-b p-4'>
            <SheetTitle className='text-left'>{t('User Menu')}</SheetTitle>
          </SheetHeader>

          <div className='flex flex-1 flex-col overflow-y-auto'>
            {/* User info section */}
            <div className='border-b p-2.5 pb-6.5'>
              <div className='flex items-center gap-2.5'>
                <Avatar className='size-9'>
                  <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
                  <AvatarFallback className='text-xs'>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-1 flex-col gap-0.5 overflow-hidden'>
                  <p className='text-foreground truncate text-sm font-medium'>
                    {displayName}
                  </p>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-muted-foreground text-xs'>
                      {roleLabel}
                    </span>
                    {user?.group && (
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
            </div>

            {/* Navigation links */}
            <SheetClose asChild>
              <Link
                to='/profile'
                className='text-primary/60 hover:text-primary/80 flex items-center gap-2.5 border-b p-2.5 transition-colors'
              >
                <User className='size-4' />
                {t('Profile')}
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                to='/wallet'
                className='text-primary/60 hover:text-primary/80 flex items-center gap-2.5 border-b p-2.5 transition-colors'
              >
                <Wallet className='size-4' />
                {t('Wallet')}
              </Link>
            </SheetClose>

            {/* System Settings - only for super admin */}
            {isSuperAdmin && (
              <SheetClose asChild>
                <Link
                  to='/system-settings/general'
                  search={{ section: 'system-info' }}
                  className='text-primary/60 hover:text-primary/80 flex items-center gap-2.5 border-b p-2.5 transition-colors'
                >
                  <Settings className='size-4' />
                  {t('System Settings')}
                </Link>
              </SheetClose>
            )}

            {/* Sign out */}
            <Button
              variant='ghost'
              onClick={() => {
                setSheetOpen(false)
                setOpen(true)
              }}
              className='text-destructive hover:text-destructive/80 h-auto w-full justify-start gap-2.5 p-2.5 hover:bg-transparent'
            >
              <LogOut className='size-4' />
              {t('Sign out')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
