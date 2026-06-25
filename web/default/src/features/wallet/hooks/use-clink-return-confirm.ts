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
import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import i18next from 'i18next'
import { toast } from 'sonner'
import { confirmClinkPayment, isApiSuccess } from '../api'
import { Route } from '@/routes/_authenticated/wallet/'

export function useClinkReturnConfirm(onSuccess: () => void) {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const confirmingRef = useRef(false)

  useEffect(() => {
    const sessionId = search.sessionId?.trim()
    if (!sessionId || confirmingRef.current) {
      return
    }

    confirmingRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const response = await confirmClinkPayment({ session_id: sessionId })
        if (cancelled) {
          return
        }
        if (isApiSuccess(response)) {
          toast.success(i18next.t('Payment successful'))
          onSuccess()
        } else {
          toast.error(i18next.t('Payment confirmation failed'))
        }
      } catch {
        if (!cancelled) {
          toast.error(i18next.t('Payment confirmation failed'))
        }
      } finally {
        if (!cancelled) {
          void navigate({
            search: (prev) => ({
              ...prev,
              sessionId: undefined,
            }),
            replace: true,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [search.sessionId, navigate, onSuccess])
}
