import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { User, Wallet, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import useDialogState from '@/hooks/use-dialog'
import { useUserDisplay } from '@/hooks/use-user-display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { ThemeQuickSwitcher } from './theme-quick-switcher'
import { cn } from '@/lib/utils'

export function ProfileDropdown() {
  const { t } = useTranslation()
  const [open, setOpen] = useDialogState()
  const [sheetOpen, setSheetOpen] = useState(false)
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, secondaryText, initials, roleLabel } =
    useUserDisplay(user)

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
        <SheetContent side='right' className='flex w-full flex-col sm:max-w-sm'>
          <SheetHeader className='pb-4'>
            <SheetTitle className='text-left'>{t('User Menu')}</SheetTitle>
          </SheetHeader>
          <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
            {/* User info section */}
            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center gap-3'>
                <Avatar className='h-12 w-12'>
                  <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-1'>
                  <p className='text-sm font-medium leading-none'>
                    {displayName}
                  </p>
                  {secondaryText ? (
                    <p className='text-muted-foreground text-xs leading-none'>
                      {secondaryText}
                    </p>
                  ) : null}
                  <div className='flex items-center gap-2 mt-1.5'>
                    {user && <Badge variant='secondary'>{roleLabel}</Badge>}
                    {user?.group && (
                      <Badge variant='outline'>{String(user.group)}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Theme segmented control */}
            <div className='border-t pt-4'>
              <ThemeQuickSwitcher />
            </div>

            {/* Navigation links */}
            <div className='flex flex-col gap-1 border-t pt-4'>
              <SheetClose asChild>
                <Link
                  to='/profile'
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'transition-colors'
                  )}
                >
                  <span className='flex items-center gap-2'>
                    <User size={16} />
                    {t('Profile')}
                  </span>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to='/wallet'
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'transition-colors'
                  )}
                >
                  <span className='flex items-center gap-2'>
                    <Wallet size={16} />
                    {t('Wallet')}
                  </span>
                </Link>
              </SheetClose>
            </div>

            {/* Sign out button */}
            <div className='mt-auto border-t pt-4'>
              <Button
                variant='ghost'
                className='w-full justify-start gap-2'
                onClick={() => {
                  setSheetOpen(false)
                  setOpen(true)
                }}
              >
                <LogOut size={16} />
                {t('Sign out')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
