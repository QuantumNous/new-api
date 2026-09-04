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
import i18next from 'i18next'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import type { PlaygroundConfig } from '../../../types'
import { PlaygroundInputTools } from '../playground-input-tools'

const baseConfig: PlaygroundConfig = {
  model: 'gpt-4o',
  group: 'default',
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

function renderTools(options: {
  config?: Partial<PlaygroundConfig>
  disabled?: boolean
  onConfigChange?: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}) {
  return render(
    <PlaygroundInputTools
      config={{ ...baseConfig, ...options.config }}
      disabled={options.disabled}
      onConfigChange={options.onConfigChange ?? (() => undefined)}
      onParameterEnabledChange={() => undefined}
      parameterEnabled={{
        temperature: true,
        top_p: true,
        max_tokens: false,
        frequency_penalty: true,
        presence_penalty: true,
        seed: false,
      }}
    />
  )
}

describe('PlaygroundInputTools search toggle', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Search: 'Search',
      'Search enabled': 'Search enabled',
    })
  })

  test('reports not pressed and calls onConfigChange(true) when search is off', async () => {
    const user = userEvent.setup()
    let recorded: { key: string; value: unknown } | null = null
    const onConfigChange = vi.fn(
      (key: keyof PlaygroundConfig, value: PlaygroundConfig[keyof PlaygroundConfig]) => {
        recorded = { key, value }
      }
    )

    renderTools({ config: { searchEnabled: false }, onConfigChange })

    const button = screen.getByRole('button', { name: 'Search' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)

    expect(recorded).toEqual({ key: 'searchEnabled', value: true })
  })

  test('reports pressed and calls onConfigChange(false) when search is on', async () => {
    const user = userEvent.setup()
    let recorded: { key: string; value: unknown } | null = null
    const onConfigChange = vi.fn(
      (key: keyof PlaygroundConfig, value: PlaygroundConfig[keyof PlaygroundConfig]) => {
        recorded = { key, value }
      }
    )

    renderTools({ config: { searchEnabled: true }, onConfigChange })

    const button = screen.getByRole('button', { name: 'Search' })
    expect(button).toHaveAttribute('aria-pressed', 'true')

    await user.click(button)

    expect(recorded).toEqual({ key: 'searchEnabled', value: false })
  })

  test('does not toggle while disabled', () => {
    let recorded: { key: string; value: unknown } | null = null
    const onConfigChange = vi.fn(
      (key: keyof PlaygroundConfig, value: PlaygroundConfig[keyof PlaygroundConfig]) => {
        recorded = { key, value }
      }
    )

    renderTools({ disabled: true, onConfigChange })

    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(recorded).toBeNull()
  })
})
