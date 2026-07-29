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
import { describe, expect, test } from 'bun:test'
import { getInvitationRewardModeConfiguration } from './invitation-reward-mode'

describe('QuotaSettingsSection invitation reward modes', () => {
  test('selects legacy top-up invitee quota when subscription invitation mode is disabled', () => {
    expect(getInvitationRewardModeConfiguration(false)).toEqual({
      inviterLabel: 'Inviter Reward',
      inviterDescription: 'Quota given to users who invite others',
      inviteeField: 'QuotaForInvitee',
      inviteeLabel: 'Invitee Reward',
      inviteeDescription: 'Quota given to invited users',
      maxCountLabel: 'Inviter Reward Limit',
      maxCountDescription:
        'Maximum inviter rewards one account can receive. Set 0 for no limit.',
    })
  })

  test('selects subscription invitee discount when subscription invitation mode is enabled', () => {
    expect(getInvitationRewardModeConfiguration(true)).toEqual({
      inviterLabel: 'Inviter subscription package credit',
      inviterDescription:
        'Granted immediately after a friend successfully buys any paid plan for the first time. The credit never expires and can only be used for subscription purchases and renewals.',
      inviteeField: 'InviteFirstSubDiscountUSD',
      inviteeLabel: 'Invitee first subscription package credit',
      inviteeDescription:
        "Discount applied to the invited user's first paid subscription package purchase.",
      maxCountLabel: 'Reward limit',
      maxCountDescription: '0 means unlimited.',
    })
  })
})
