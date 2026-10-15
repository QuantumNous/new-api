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
import i18next from 'i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

// Every hosted checkout uses this entry point, including POST-based gateways.
// Retrying a blocked popup reuses the checkout, never the order-creation API.
export function openPaymentWindow(
  url: string | (() => Promise<string>),
  params?: Record<string, unknown>
): boolean {
  let destination: URL | undefined
  try {
    if (typeof url === 'string') destination = new URL(url)
    if (
      destination &&
      (!['https:', 'http:'].includes(destination.protocol) ||
        destination.username ||
        destination.password)
    ) {
      throw new Error('Invalid checkout URL')
    }
  } catch {
    toast.error(i18next.t('Invalid payment redirect URL'))
    return false
  }
  const width = Math.min(1080, window.screen.availWidth || 1080)
  const height = Math.min(720, window.screen.availHeight || 720)
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
  const popup = window.open(
    '',
    '_blank',
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`
  )
  if (!popup) {
    toast.error(
      i18next.t(
        'Your browser blocked the payment window. Allow pop-ups and open the payment page.'
      ),
      {
        id: 'payment-window-blocked',
        duration: Infinity,
        action: {
          label: i18next.t('Open payment page'),
          onClick: () => {
            openPaymentWindow(url, params)
          },
        },
      }
    )
    return false
  }
  // Detach before loading any third-party content to prevent reverse tabnabbing.
  popup.opener = null
  if (typeof url === 'function') {
    popup.document.title = i18next.t('Payment')
    popup.document.body.textContent = i18next.t(
      'Redirecting to payment page...'
    )
    popup.focus()
    void url()
      .then((value) => {
        const target = new URL(value)
        if (
          !['https:', 'http:'].includes(target.protocol) ||
          target.username ||
          target.password
        ) {
          throw new Error(i18next.t('Invalid payment redirect URL'))
        }
        if (!popup.closed) popup.location.replace(target.href)
      })
      .catch((error: unknown) => {
        popup.close()
        handleServerError(error, i18next.t('Payment request failed'))
      })
    return true
  }
  if (!destination) {
    popup.close()
    return false
  }
  try {
    if (params) {
      const form = popup.document.createElement('form')
      form.action = destination.href
      form.method = 'POST'
      for (const [name, value] of Object.entries(params)) {
        const input = popup.document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = String(value)
        form.appendChild(input)
      }
      popup.document.body.appendChild(form)
      form.submit()
    } else {
      popup.location.replace(destination.href)
    }
    popup.focus()
    return true
  } catch (error) {
    popup.close()
    throw error
  }
}
