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
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { StreamTpsCell, TimingMetricsCell } from '../timing-metrics-cell'

// "127 t/s" and "1m 5s" mix digits, spaces and Latin units. On a
// right-to-left page they are isolated left to right, otherwise they render
// as "t/s 127" and "5s 1m".

it('isolates the throughput value left to right', () => {
  render(<StreamTpsCell isStream tokensPerSecond={127.4} />)

  expect(screen.getByText('127 t/s')).toHaveAttribute('dir', 'ltr')
})

it('isolates the duration and first-token values left to right', () => {
  render(
    <TimingMetricsCell
      useTimeSec={65}
      completionTokens={420}
      frtMs={1200}
      isStream
    />
  )

  expect(screen.getByText('1m 5s')).toHaveAttribute('dir', 'ltr')
  expect(screen.getByText('1.2s')).toHaveAttribute('dir', 'ltr')
})
