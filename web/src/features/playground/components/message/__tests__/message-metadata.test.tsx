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
import { describe, expect, test, vi } from 'vitest'

import type { Message } from '../../../types'
import { MessageMetadata } from '../message-metadata'

vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  formatQuota: (quota: number) => `Q${quota}`,
}))

function assistant(usage?: Message['usage']): Message {
  return {
    key: 'a-1',
    from: 'assistant',
    versions: [{ id: 'v1', content: 'hi' }],
    usage,
  }
}

describe('MessageMetadata usage line', () => {
  test('shows tokens in and out, the cost and the remaining credit', () => {
    render(
      <MessageMetadata
        alignment='left'
        message={assistant({
          promptTokens: 13,
          completionTokens: 242,
          costQuota: 33,
          balanceQuota: 499_967,
        })}
      />
    )
    const line = screen.getByTestId('playground-message-usage')
    expect(line.textContent).toContain('Tokens: 13 in, 242 out')
    expect(line.textContent).toContain('Cost: Q33')
    expect(line.textContent).toContain('Remaining credit: Q499967')
  })

  test('a failed test shows cost 0 and the unchanged credit, no tokens', () => {
    render(
      <MessageMetadata
        alignment='left'
        message={assistant({ costQuota: 0, balanceQuota: 500_000 })}
      />
    )
    const line = screen.getByTestId('playground-message-usage')
    expect(line.textContent).not.toContain('Tokens')
    expect(line.textContent).toContain('Cost: Q0')
    expect(line.textContent).toContain('Remaining credit: Q500000')
  })

  test('renders nothing without time, duration or usage', () => {
    const { container } = render(
      <MessageMetadata alignment='left' message={assistant()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
