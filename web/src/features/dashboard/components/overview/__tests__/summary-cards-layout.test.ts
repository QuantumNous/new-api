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

import { summaryCardsLayoutClasses } from '../summary-cards-layout.ts'

describe('dashboard summary cards layout', () => {
  test('uses a wide-screen usage and account column without constraining mobile', () => {
    const gridClasses = summaryCardsLayoutClasses.grid.split(' ')
    const usageClasses = summaryCardsLayoutClasses.usage.split(' ')
    const accountClasses = summaryCardsLayoutClasses.account.split(' ')

    assert.ok(gridClasses.includes('grid'))
    assert.ok(gridClasses.includes('xl:grid-cols-[minmax(0,1fr)_19rem]'))
    assert.ok(usageClasses.includes('min-w-0'))
    assert.ok(accountClasses.includes('min-w-0'))
  })

  test('places savings below both desktop columns instead of stretching either column', () => {
    const savingsClasses = summaryCardsLayoutClasses.savings.split(' ')
    const accountClasses = summaryCardsLayoutClasses.account.split(' ')

    assert.ok(savingsClasses.includes('xl:col-span-2'))
    assert.ok(savingsClasses.includes('border-t'))
    assert.ok(accountClasses.includes('xl:border-l'))
    assert.ok(accountClasses.includes('xl:border-t-0'))
  })
})
