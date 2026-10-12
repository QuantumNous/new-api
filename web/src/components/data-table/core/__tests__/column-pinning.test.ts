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

import { getResolvedColumnClassName } from '../column-pinning'

describe('pinned column offsets', () => {
  it('sticks a left-pinned column to the inline start so it stays first in RTL', () => {
    const resolve = getResolvedColumnClassName(undefined, [
      { columnId: 'name', side: 'left' },
    ])

    const className = resolve('name', 'cell') ?? ''

    expect(className.split(' ')).toContain('start-0')
    expect(className.split(' ')).not.toContain('left-0')
  })

  it('sticks a right-pinned column to the inline end so it stays last in RTL', () => {
    const resolve = getResolvedColumnClassName(undefined, [
      { columnId: 'actions', side: 'right' },
    ])

    const className = resolve('actions', 'header') ?? ''

    expect(className.split(' ')).toContain('end-0')
    expect(className.split(' ')).not.toContain('right-0')
  })

  it('leaves unpinned columns without a sticky offset', () => {
    const resolve = getResolvedColumnClassName(undefined, [
      { columnId: 'actions', side: 'right' },
    ])

    expect(resolve('name', 'cell')).toBeUndefined()
  })
})
