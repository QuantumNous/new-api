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

export type UpdateOptionNotification = {
  success?: string | false
  error?: string | false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(error: unknown): string | undefined {
  if (isRecord(error)) {
    const response = error.response
    if (isRecord(response) && isRecord(response.data)) {
      const message = response.data.message
      if (typeof message === 'string' && message) return message
    }
  }

  if (error instanceof Error && error.message) return error.message
  return undefined
}

export function showUpdateOptionSuccess(
  notification: UpdateOptionNotification | undefined,
  toastId: string
) {
  if (notification?.success === false) return

  toast.success(
    notification?.success || i18next.t('Setting updated successfully'),
    { id: toastId }
  )
}

export function showUpdateOptionError(
  error: unknown,
  notification: UpdateOptionNotification | undefined,
  toastId: string
) {
  if (notification?.error === false) return

  toast.error(
    getErrorMessage(error) ||
      notification?.error ||
      i18next.t('Failed to update setting'),
    { id: toastId }
  )
}
