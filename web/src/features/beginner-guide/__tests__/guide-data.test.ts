/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, it } from 'vitest'

import { guideTools, useCaseRows } from '../data'

describe('beginner guide tool catalog', () => {
  it('restores the complete historical tool catalog', () => {
    expect(guideTools).toHaveLength(31)
    expect(guideTools.find((tool) => tool.id === 'workbuddy')).toMatchObject({
      name: 'WorkBuddy / CodeBuddy',
      category: 'chat',
      status: 'green',
      recommended: true,
    })
    expect(guideTools.find((tool) => tool.id === 'codex')).toMatchObject({
      name: 'Codex CLI',
      category: 'coding',
      status: 'blue',
    })
  })

  it('maps every use-case card to existing tool ids', () => {
    const toolIds = new Set(guideTools.map((tool) => tool.id))

    for (const row of useCaseRows) {
      expect(row.toolIds.length, row.useCase).toBeGreaterThan(0)
      for (const id of row.toolIds) {
        expect(toolIds.has(id), `${row.useCase} -> ${id}`).toBe(true)
      }
    }
  })
})
