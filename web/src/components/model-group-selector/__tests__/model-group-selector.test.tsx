/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { ModelGroupSelector } from '../../model-group-selector'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

const groups = [
  { label: 'Claude-Code-Kiro-A', value: 'claude-kiro-a' },
  {
    label: 'Claude-Code-Kiro-Long-Context',
    value: 'claude-kiro-long-context',
  },
]

describe('ModelGroupSelector group labels', () => {
  test('exposes the complete group name when a label is truncated', async () => {
    const user = userEvent.setup()

    render(
      <ModelGroupSelector
        groups={groups}
        models={[]}
        onGroupChange={() => undefined}
        onModelChange={() => undefined}
        selectedGroup={groups[0].value}
        selectedModel=''
      />
    )

    await user.click(screen.getByRole('combobox'))

    expect(
      screen.getByRole('button', { name: groups[0].label })
    ).toHaveAttribute('title', groups[0].label)
    expect(
      screen.getByRole('button', { name: groups[1].label })
    ).toHaveAttribute('title', groups[1].label)
  })
})
