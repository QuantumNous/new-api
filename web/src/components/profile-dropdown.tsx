import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getRoleLabel } from '@/lib/roles'
import useDialogState from '@/hooks/use-dialog-state'
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

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)

  const displayName = user?.display_name || user?.username || 'User'
  const secondaryText = (() => {
    if (user?.email) return user.email
    if (user?.github_id) return `GitHub ID: ${user.github_id}`
    if (user?.oidc_id) return `OIDC ID: ${user.oidc_id}`
    if (user?.wechat_id) return `WeChat ID: ${user.wechat_id}`
    if (user?.telegram_id) return `Telegram ID: ${user.telegram_id}`
    if (user?.linux_do_id) return `LinuxDO ID: ${user.linux_do_id}`
    if (user?.username) return user.username
    if (user?.display_name) return user.display_name
    return ''
  })()
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleLabel = getRoleLabel(user?.role)

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
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
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/settings'>
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/settings'>
                Billing
                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            Sign out
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
