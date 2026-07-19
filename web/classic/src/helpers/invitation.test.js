/*
Copyright (C) 2025 QuantumNous

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

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  clearLegacyInvitationCodeStorage,
  getInvitationCodeMethods,
  isInvitationCodeRequired,
} from './invitation.js';

describe('invitation code compatibility', () => {
  test('falls back to LinuxDO when the methods field is missing', () => {
    const status = { invitation_code_required: true };

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo']);
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), true);
  });

  test('falls back to LinuxDO when the methods field is not an array', () => {
    const status = {
      invitation_code_required: true,
      invitation_code_methods: 'linuxdo',
    };

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo']);
  });

  test('preserves an explicit disabled configuration with an empty array', () => {
    const status = {
      invitation_code_required: false,
      invitation_code_methods: [],
    };

    assert.deepEqual(getInvitationCodeMethods(status), []);
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), false);
  });

  test('repairs a legacy required configuration with an empty array', () => {
    const status = {
      invitation_code_required: true,
      invitation_code_methods: [],
    };

    assert.deepEqual(getInvitationCodeMethods(status), ['linuxdo']);
    assert.equal(isInvitationCodeRequired(status, 'linuxdo'), true);
  });

  test('removes duplicate and unknown registration methods', () => {
    const status = {
      invitation_code_required: true,
      invitation_code_methods: ['github', 'unknown', 'github', null, 'linuxdo'],
    };

    assert.deepEqual(getInvitationCodeMethods(status), ['github', 'linuxdo']);
    assert.deepEqual(
      getInvitationCodeMethods({
        invitation_code_required: true,
        invitation_code_methods: ['unknown', 'unknown'],
      }),
      ['linuxdo'],
    );
  });

  test('clears both historical invitation-code storage keys', () => {
    const values = new Map([
      ['registration:invitation-code', 'CURRENT'],
      ['invitation_code', 'LEGACY'],
      ['aff', 'AFF'],
    ]);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    );
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        removeItem: (key) => values.delete(key),
      },
    });

    try {
      clearLegacyInvitationCodeStorage();
      assert.equal(values.has('registration:invitation-code'), false);
      assert.equal(values.has('invitation_code'), false);
      assert.equal(values.get('aff'), 'AFF');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      } else {
        delete globalThis.localStorage;
      }
    }
  });
});
