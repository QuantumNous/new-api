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
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'

import { Markdown } from '../markdown'

test.each([
  ['inline', 'Formula: $$\\frac{1}{2}$$.'],
  ['display', '$$\n\\frac{1}{2}\n$$'],
  ['fenced', '```math\n\\frac{1}{2}\n```'],
])('preserves MathML and visual output when rendering %s math', (_, source) => {
  const view = render(<Markdown>{source}</Markdown>)
  const math = view.getByRole('math', { hidden: true })

  expect(math.querySelector('mfrac')).not.toBeNull()
  expect(math.querySelector('annotation')).toHaveTextContent('\\frac{1}{2}')
  expect(view.container.querySelector('.katex-html')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
})

test('does not load math resources when trust is inherited from a polluted prototype', () => {
  const originalTrust = Object.getOwnPropertyDescriptor(
    Object.prototype,
    'trust'
  )

  try {
    Object.defineProperty(Object.prototype, 'trust', {
      configurable: true,
      value: true,
      writable: true,
    })

    const view = render(
      <Markdown>
        {'$$\\includegraphics{https://example.com/untrusted.png}$$'}
      </Markdown>
    )

    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container).toHaveTextContent('\\includegraphics')
  } finally {
    if (originalTrust) {
      Object.defineProperty(Object.prototype, 'trust', originalTrust)
    } else {
      Reflect.deleteProperty(Object.prototype, 'trust')
    }
  }
})
