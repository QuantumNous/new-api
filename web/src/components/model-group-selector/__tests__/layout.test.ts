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
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { ModelGroupSelector } from '../../model-group-selector'
import { scrollSelectedOptionIntoView } from '../layout'

describe('model group selector layout', () => {
  test('opened desktop group options keep fixed-height rows aligned to the top', async () => {
    const user = userEvent.setup()
    render(
      createElement(ModelGroupSelector, {
        selectedModel: 'model-a',
        models: [{ label: 'Model A', value: 'model-a' }],
        onModelChange: vi.fn(),
        selectedGroup: 'group-a',
        groups: [{ label: 'Group A', value: 'group-a' }],
        onGroupChange: vi.fn(),
      })
    )

    await user.click(screen.getByRole('combobox'))

    const option = await screen.findByRole('button', { name: 'Group A' })
    expect(option.parentElement).toHaveClass(
      'auto-rows-[2rem]',
      'content-start'
    )
  })

  test('centers the selected group inside its own scroll container', () => {
    const scrollCalls: ScrollToOptions[] = []
    const selectedOption = {
      offsetHeight: 32,
      offsetTop: 160,
      scrollIntoView() {},
    }
    const scrollContainer = {
      clientHeight: 200,
      scrollTop: 0,
      scrollTo(options: ScrollToOptions) {
        scrollCalls.push(options)
      },
    }

    scrollSelectedOptionIntoView(selectedOption, scrollContainer)

    expect(scrollCalls).toEqual([{ top: 76, behavior: 'auto' }])
  })

  test('falls back to scrollIntoView when no group container is provided', () => {
    const scrollCalls: ScrollIntoViewOptions[] = []
    const selectedOption = {
      scrollIntoView(options?: ScrollIntoViewOptions) {
        scrollCalls.push(options ?? {})
      },
    }

    scrollSelectedOptionIntoView(selectedOption)

    expect(scrollCalls).toEqual([{ block: 'center', inline: 'nearest' }])
  })
})
