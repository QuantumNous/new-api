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
import { useCallback, useEffect, useState } from 'react'
import { useStatus } from '@/hooks/use-status'

const INVITE_PROMO_LS_KEY = 'invite_promo_last_shown'
const INVITE_PROMO_COOLDOWN_MS = 24 * 60 * 60 * 1000
const PENDING_ATTEMPT_KEY = 'invite_promo_pending_attempt'

export function usePostTopupInvitePrompt() {
  const { status } = useStatus()
  const affRatio = (status as any)?.aff_ratio ?? 0
  const [open, setOpen] = useState(false)

  const canShow = useCallback(() => {
    if (affRatio <= 0) return false
    const last = localStorage.getItem(INVITE_PROMO_LS_KEY)
    if (last && Date.now() - Number(last) < INVITE_PROMO_COOLDOWN_MS) return false
    return true
  }, [affRatio])

  const maybeShow = useCallback(() => {
    if (!canShow()) return
    setOpen(true)
    localStorage.setItem(INVITE_PROMO_LS_KEY, String(Date.now()))
  }, [canShow])

  const handleWindowFocus = useCallback(() => {
    if (!sessionStorage.getItem(PENDING_ATTEMPT_KEY)) return
    sessionStorage.removeItem(PENDING_ATTEMPT_KEY)
    maybeShow()
  }, [maybeShow])

  useEffect(() => {
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [handleWindowFocus])

  // For payment methods that redirect to a new tab/window: mark an attempt as
  // pending, then rely on the window `focus` listener above to fire once the
  // user switches back — regardless of whether that payment succeeded or failed.
  const notifyPaymentInitiated = useCallback(() => {
    sessionStorage.setItem(PENDING_ATTEMPT_KEY, '1')
  }, [])

  // For payment methods that resolve in-page (Crypto's done/failed steps,
  // Clink's confirm callback): call directly once the outcome is known.
  const notifyTopupSettled = useCallback(() => {
    maybeShow()
  }, [maybeShow])

  return {
    open,
    onOpenChange: setOpen,
    affRatio,
    notifyPaymentInitiated,
    notifyTopupSettled,
  }
}
