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
import { describe, expect, test } from 'vitest'

import { RichContent } from '../rich-content'

describe('RichContent', () => {
  test('renders Markdown after its deferred renderer loads', async () => {
    render(<RichContent content='**Deferred Markdown**' />)

    expect(await screen.findByText('Deferred Markdown')).toBeInTheDocument()
    expect(screen.getByText('Deferred Markdown').tagName).toBe('STRONG')
  })

  test('keeps HTML content on the immediate renderer path', () => {
    render(<RichContent mode='html' content='<strong>Trusted HTML</strong>' />)

    expect(screen.getByText('Trusted HTML').tagName).toBe('STRONG')
  })
})
