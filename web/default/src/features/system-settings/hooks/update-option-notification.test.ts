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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { toast } from 'sonner'

import {
  showUpdateOptionError,
  showUpdateOptionSuccess,
} from './update-option-notification'

describe('system option notifications', () => {
  test('reuses one toast for all updates in the same save action', () => {
    const toastId = 'update-option-batch-success-test'

    showUpdateOptionSuccess({ success: 'First update saved' }, toastId)
    showUpdateOptionSuccess({ success: 'Settings saved' }, toastId)

    const matchingToasts = toast
      .getHistory()
      .filter((item) => item.id === toastId)
    const matchingToast = matchingToasts[0]

    assert.equal(matchingToasts.length, 1)
    assert.ok(matchingToast && 'title' in matchingToast)
    assert.equal(matchingToast.title, 'Settings saved')
  })

  test('allows composite save flows to suppress intermediate success toasts', () => {
    const toastId = 'update-option-suppressed-success-test'

    showUpdateOptionSuccess({ success: false }, toastId)

    assert.equal(
      toast.getHistory().some((item) => item.id === toastId),
      false
    )
  })

  test('replaces a partial success with the save error', () => {
    const toastId = 'update-option-error-test'

    showUpdateOptionSuccess(undefined, toastId)
    showUpdateOptionError(
      { response: { data: { message: 'Backend rejected the setting' } } },
      undefined,
      toastId
    )

    const matchingToasts = toast
      .getHistory()
      .filter((item) => item.id === toastId)
    const matchingToast = matchingToasts[0]

    assert.equal(matchingToasts.length, 1)
    assert.ok(matchingToast && 'title' in matchingToast)
    assert.equal(matchingToast.title, 'Backend rejected the setting')
    assert.equal(matchingToast.type, 'error')
  })
})
