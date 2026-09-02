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
import { describe, expect, it } from 'vitest'

import { guideTools } from '../data'

describe('guide tool catalog', () => {
  it('includes the official DeepSeek Harness setup path', () => {
    const dsh = guideTools.find((tool) => tool.id === 'dsh')

    expect(dsh).toMatchObject({
      name: 'DeepSeek Harness (DSH)',
      category: 'coding',
      status: 'green',
      recommended: true,
    })
    expect(dsh?.steps.join('\n')).toContain('npx @deepseek-ai/dsh web')
    expect(dsh?.steps.join('\n')).toContain('{{BASE_URL}}')
  })

  it('marks Cockpit Tools API configuration as directly supported', () => {
    const cockpit = guideTools.find((tool) => tool.id === 'cockpit-tools')

    expect(cockpit?.status).toBe('green')
    expect(cockpit?.steps.join('\n')).toContain('API Key')
    expect(cockpit?.steps.join('\n')).toContain('{{BASE_URL}}')
    expect(cockpit?.steps.join('\n')).toContain('Codex API Service')
  })

  it('recommends locally familiar entry points without promoting Cherry Studio', () => {
    expect(
      guideTools.find((tool) => tool.id === 'immersive-translate')
    ).toHaveProperty('recommended', true)
    expect(guideTools.find((tool) => tool.id === 'trae')).toHaveProperty(
      'recommended',
      true
    )
    expect(
      guideTools.find((tool) => tool.id === 'cherry-studio')
    ).not.toHaveProperty('recommended', true)
  })
})
