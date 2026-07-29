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

import {
  MAX_USER_EMAIL_RECIPIENTS,
  userEmailFormSchema,
  userEmailRecipientIdsSchema,
} from '../user-email-form'

describe('user email form validation', () => {
  test('accepts a subject and message while trimming outer whitespace', () => {
    const result = userEmailFormSchema.parse({
      subject: '  Service update  ',
      content: '  Maintenance starts tonight.  ',
    })

    assert.deepEqual(result, {
      subject: 'Service update',
      content: 'Maintenance starts tonight.',
    })
  })

  test('rejects empty and oversized email fields', () => {
    const emptyResult = userEmailFormSchema.safeParse({
      subject: ' ',
      content: '',
    })
    const oversizedResult = userEmailFormSchema.safeParse({
      subject: 's'.repeat(201),
      content: 'm'.repeat(10001),
    })

    assert.equal(emptyResult.success, false)
    assert.equal(oversizedResult.success, false)
  })

  test('rejects header line breaks and selections over the recipient limit', () => {
    const headerInjectionResult = userEmailFormSchema.safeParse({
      subject: 'Notice\r\nBcc: attacker@example.com',
      content: 'Message',
    })
    const oversizedSelection = Array.from(
      { length: MAX_USER_EMAIL_RECIPIENTS + 1 },
      (_, index) => index + 1
    )

    assert.equal(headerInjectionResult.success, false)
    assert.equal(
      userEmailRecipientIdsSchema.safeParse(oversizedSelection).success,
      false
    )
  })
})
