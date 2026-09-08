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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/canvas-sso')({
  component: CanvasSsoPage,
})

/**
 * Relay page for the infinite-canvas SSO jump: fetches the short-lived SSO
 * callback URL with the Authorization header (a plain navigation cannot carry
 * the in-memory access token), then redirects the browser to infinite-canvas.
 */
function CanvasSsoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await api.get('/api/user/canvas-sso')
        const redirectUrl: string | undefined = res.data?.data?.redirect_url
        if (cancelled) return
        if (redirectUrl) {
          window.location.href = redirectUrl
          return
        }
      } catch {
        // Errors (including 401 refresh failures) are already surfaced by
        // the HTTP client interceptor toasts.
      }
      if (!cancelled) {
        navigate({ to: '/', replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3'>
      <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      <p className='text-muted-foreground text-sm'>
        {t('Redirecting to canvas...')}
      </p>
    </div>
  )
}
