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

import type { SystemStatus } from '../types'
import {
  getInvitationCodeMethods,
  INVITATION_REGISTRATION_METHODS,
  isInvitationCodeRequired,
  type InvitationRegistrationMethod,
} from './invitation.ts'

function asStatus(value: unknown): SystemStatus {
  return value as SystemStatus
}

describe('invitation code compatibility', () => {
  test('falls back to LinuxDO when the methods field is missing', () => {
    const status = asStatus({ invitation_code_required: true })

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo'])
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), true)
  })

  test('falls back to LinuxDO when the methods field is not an array', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: 'linuxdo',
    })

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo'])
  })

  test('preserves an explicit disabled configuration with an empty array', () => {
    const status = asStatus({
      invitation_code_required: false,
      invitation_code_methods: [],
    })

    assert.deepEqual(getInvitationCodeMethods(status), [])
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), false)
  })

  test('repairs a legacy required configuration with an empty array', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: [],
    })

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo'])
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), true)
  })

  test('removes duplicate and unknown registration methods', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: ['github', 'unknown', 'github', null, 'linuxdo'],
    })

    assert.deepEqual(getInvitationCodeMethods(status), ['github', 'linuxdo'])
    assert.deepEqual(
      getInvitationCodeMethods(
        asStatus({
          invitation_code_required: true,
          invitation_code_methods: ['unknown', 'unknown'],
        })
      ),
      ['linuxdo']
    )
  })

  test('maps supported registration methods including wechat and custom_oauth', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: [
        'password',
        'wechat',
        'github',
        'discord',
        'oidc',
        'linuxdo',
        'custom_oauth',
      ],
    })

    assert.deepEqual(getInvitationCodeMethods(status), [
      'password',
      'wechat',
      'github',
      'discord',
      'oidc',
      'linuxdo',
      'custom_oauth',
    ])
    for (const method of INVITATION_REGISTRATION_METHODS) {
      assert.equal(isInvitationCodeRequired(status, method), true)
    }
  })

  test('Telegram is never an invitation registration method', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: ['telegram', 'github', 'password'],
    })

    assert.deepEqual(getInvitationCodeMethods(status), ['github', 'password'])
    assert.equal(
      INVITATION_REGISTRATION_METHODS.includes(
        'telegram' as InvitationRegistrationMethod
      ),
      false
    )
    // isInvitationCodeRequired rejects telegram via type, but runtime cast stays false
    assert.equal(
      isInvitationCodeRequired(
        status,
        'telegram' as InvitationRegistrationMethod
      ),
      false
    )
  })

  test('provider isolation: only configured methods require invitation', () => {
    const status = asStatus({
      invitation_code_required: true,
      invitation_code_methods: ['github'],
    })

    assert.equal(isInvitationCodeRequired(status, 'github'), true)
    assert.equal(isInvitationCodeRequired(status, 'discord'), false)
    assert.equal(isInvitationCodeRequired(status, 'password'), false)
    assert.equal(isInvitationCodeRequired(status, 'wechat'), false)
    assert.equal(isInvitationCodeRequired(status, 'custom_oauth'), false)
  })

  test('required=false never requires invitation regardless of methods list', () => {
    const status = asStatus({
      invitation_code_required: false,
      invitation_code_methods: ['password', 'github', 'wechat'],
    })

    for (const method of INVITATION_REGISTRATION_METHODS) {
      assert.equal(isInvitationCodeRequired(status, method), false)
    }
  })

  test('reads nested status.data invitation fields', () => {
    const status = asStatus({
      data: {
        invitation_code_required: true,
        invitation_code_methods: ['password', 'oidc'],
      },
    })

    assert.deepEqual(getInvitationCodeMethods(status), ['password', 'oidc'])
    assert.equal(isInvitationCodeRequired(status, 'password'), true)
    assert.equal(isInvitationCodeRequired(status, 'oidc'), true)
    assert.equal(isInvitationCodeRequired(status, 'github'), false)
  })
})
