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

import { minimalHomeLayoutClasses } from '../home-layout.ts'

describe('minimal home layout', () => {
  test('keeps the default home page constrained to one viewport shell', () => {
    const shellClasses = minimalHomeLayoutClasses.shell.split(' ')
    const heroClasses = minimalHomeLayoutClasses.hero.split(' ')

    assert.ok(shellClasses.includes('min-h-svh'))
    assert.ok(shellClasses.includes('flex-col'))
    assert.ok(heroClasses.includes('flex-1'))
    assert.ok(heroClasses.includes('items-center'))
    assert.ok(heroClasses.includes('justify-center'))
  })

  test('stacks primary actions on small screens and aligns them on larger screens', () => {
    const actionClasses = minimalHomeLayoutClasses.actions.split(' ')

    assert.ok(actionClasses.includes('flex-col'))
    assert.ok(actionClasses.includes('items-stretch'))
    assert.ok(actionClasses.includes('sm:flex-row'))
    assert.ok(actionClasses.includes('sm:items-center'))
  })
})
