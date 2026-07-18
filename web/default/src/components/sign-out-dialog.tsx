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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { logout } from '@/features/auth/api'
import {
  beginSignOut,
  resetSessionVerified,
} from '@/features/auth/lib/session-verification'
import { clearInFlightGetRequests } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { t } = useTranslation()
  const { auth } = useAuthStore()

  const handleSignOut = async () => {
    // 标记登出中：拦截器/QueryCache 不再弹出 Session expired 或二次跳转。
    beginSignOut()
    clearInFlightGetRequests()

    // 先清本地，再请求服务端删 cookie，最后硬跳登录页。
    resetSessionVerified()
    auth.reset()
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('uid')
        window.localStorage.removeItem('user')
      }
    } catch {
      /* empty */
    }

    try {
      await logout()
    } catch {
      /* empty */
    }

    toast.success(t('Signed out'))
    if (typeof window !== 'undefined') {
      // replace 避免回退键回到已登出的鉴权页；整页跳转清空内存态 QueryCache。
      window.location.replace('/sign-in')
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Sign out')}
      desc={t(
        'Are you sure you want to sign out? You will need to sign in again to access your account.'
      )}
      confirmText={t('Sign out')}
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
