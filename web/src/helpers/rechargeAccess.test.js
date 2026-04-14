import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAccessWalletManagement,
  isRechargeRestricted,
} from './rechargeAccess.js';

test('wallet management is available for recharge-enabled users', () => {
  assert.equal(
    canAccessWalletManagement({
      id: 1,
      allow_recharge: true,
    }),
    true,
  );
});

test('wallet management is hidden for recharge-restricted users', () => {
  assert.equal(
    canAccessWalletManagement({
      id: 2,
      allow_recharge: false,
    }),
    false,
  );
  assert.equal(
    isRechargeRestricted({
      id: 2,
      allow_recharge: false,
    }),
    true,
  );
});

test('wallet management is hidden safely when user data is missing', () => {
  assert.equal(canAccessWalletManagement(null), false);
  assert.equal(isRechargeRestricted(null), false);
});

test('wallet management stays available when allow_recharge is missing', () => {
  assert.equal(
    canAccessWalletManagement({
      id: 3,
      username: 'legacy-user',
    }),
    true,
  );
  assert.equal(
    isRechargeRestricted({
      id: 3,
      username: 'legacy-user',
    }),
    false,
  );
});
