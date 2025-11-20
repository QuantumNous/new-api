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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { ThemeQuickSwitcher } from './theme-quick-switcher'

export function ProfileDropdown() {
  const { t } = useTranslation()
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, secondaryText, initials, roleLabel } =
    useUserDisplay(user)

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-9 w-9 rounded-full p-0'>
            <Avatar className='h-9 w-9'>
              <AvatarImage src='/avatars/01.png' alt={`@${displayName}`} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>{displayName}</p>
              {secondaryText ? (
                <p className='text-muted-foreground text-xs leading-none'>
                  {secondaryText}
                </p>
              ) : null}
              <div className='flex items-center gap-2'>
                {user && <Badge variant='secondary'>{roleLabel}</Badge>}
                {user?.group && (
                  <Badge variant='outline'>{String(user.group)}</Badge>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          {/* Theme segmented control */}
          <ThemeQuickSwitcher />
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/profile'>
                {t('Profile')}
                <DropdownMenuShortcut>
                  <User size={16} />
                </DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/wallet'>
                {t('Wallet')}
                <DropdownMenuShortcut>
                  <Wallet size={16} />
                </DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            {t('Sign out')}
            <DropdownMenuShortcut>
              <LogOut size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
