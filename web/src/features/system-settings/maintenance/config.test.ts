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
import { describe, test } from 'vitest'

import { SIDEBAR_MODULES_DEFAULT, parseSidebarModulesAdmin } from './config'

describe('agent sidebar settings compatibility', () => {
  test('new agent modules default to visible for legacy configurations', () => {
    const parsed = parseSidebarModulesAdmin(
      JSON.stringify({
        personal: { enabled: true, topup: true, personal: true },
        admin: { enabled: true, user: true, setting: true },
      })
    )

    assert.equal(SIDEBAR_MODULES_DEFAULT.personal.agent, true)
    assert.equal(SIDEBAR_MODULES_DEFAULT.admin.agent_management, true)
    assert.equal(parsed.personal.agent, true)
    assert.equal(parsed.admin.agent_management, true)
  })

  test('explicit agent module opt-outs remain disabled', () => {
    const parsed = parseSidebarModulesAdmin(
      JSON.stringify({
        personal: { enabled: true, agent: false },
        admin: { enabled: true, agent_management: false },
      })
    )

    assert.equal(parsed.personal.agent, false)
    assert.equal(parsed.admin.agent_management, false)
  })
})
