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
import { useNavigate } from '@tanstack/react-router'
import {
  ExternalLink,
  User,
  Wallet,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SignOutDialog } from '@/shared/components/sign-out-dialog'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import useDialogState from '@/shared/hooks/use-dialog'
import { useIsSidebarModuleVisible } from '@/shared/hooks/use-sidebar-config'
import { useUserDisplay } from '@/shared/hooks/use-user-display'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/shared/lib/avatar'
import {
  isCrossOriginPortal,
  portalHref,
  type Portal,
} from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

const avatarFallbackClassName = 'font-semibold text-white'

type ProfileDropdownProps = {
  /**
   * Portal that owns the surrounding chrome. Admin chrome must not offer
   * client-account destinations; it links across to the client portal instead.
   */
  portalContext?: Portal
}

export function ProfileDropdown(props: ProfileDropdownProps) {
  const { t } = useTranslation()
  const portalContext = props.portalContext ?? 'client'
  const isAdminPortal = portalContext === 'admin'
  const navigate = useNavigate()
  const [open, setOpen] = useDialogState()
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, roleLabel } = useUserDisplay(user)
  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN
  const isWalletVisible = useIsSidebarModuleVisible('/app/wallet')
  const isSecurityVisible = useIsSidebarModuleVisible('/app/security')
  const avatarName = user?.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = useMemo(
    () => getUserAvatarStyle(avatarName),
    [avatarName]
  )

  /** The client portal may live on another origin in split deployments. */
  const goToClientPortal = () => {
    if (isCrossOriginPortal('client')) {
      window.location.assign(portalHref('client', '/app/workspace'))
      return
    }
    void navigate({ to: '/app/workspace' })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<Button variant='ghost' className='relative size-6 p-0' />}
        >
          <Avatar className='size-6'>
            <AvatarFallback
              className={`${avatarFallbackClassName} text-[11px]`}
              style={avatarFallbackStyle}
            >
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' sideOffset={8} className='w-56'>
          <div className='flex items-center gap-2 px-1.5 py-1.5'>
            <Avatar className='size-8'>
              <AvatarFallback
                className={`${avatarFallbackClassName} text-xs`}
                style={avatarFallbackStyle}
              >
                {avatarFallback}
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
                    <span className='text-muted-foreground truncate text-xs'>
                      {String(user.group)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          {isAdminPortal ? (
            <DropdownMenuItem onClick={goToClientPortal}>
              <ExternalLink className='size-4' />
              {t('Go to Client Portal')}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => navigate({ to: '/app/profile' })}
              >
                <User className='size-4' />
                {t('Profile')}
              </DropdownMenuItem>

              {isSecurityVisible && (
                <DropdownMenuItem
                  onClick={() => navigate({ to: '/app/security' })}
                >
                  <ShieldCheck className='size-4' />
                  {t('Security & Access')}
                </DropdownMenuItem>
              )}

              {isWalletVisible && (
                <DropdownMenuItem
                  onClick={() => navigate({ to: '/app/wallet' })}
                >
                  <Wallet className='size-4' />
                  {t('Wallet')}
                </DropdownMenuItem>
              )}

              {isSuperAdmin && (
                <DropdownMenuItem
                  onClick={() =>
                    navigate({
                      to: '/admin/system-settings/site/$section',
                      params: { section: 'system-info' },
                    })
                  }
                >
                  <Settings className='size-4' />
                  {t('System Settings')}
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            <LogOut className='size-4' />
            {t('Sign out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
