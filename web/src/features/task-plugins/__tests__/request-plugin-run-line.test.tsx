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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import type { TaskPluginOption } from '@/features/channels/api'

import { RequestPluginRunLine } from '../components/request-plugin-summary'

afterEach(cleanup)

function plugin(hooks: string[], optional = false): TaskPluginOption {
  return {
    key: 'example',
    name: 'Example',
    models: [],
    task: false,
    provider: false,
    transform: true,
    transform_hooks: hooks,
    optional,
  }
}

test('a plugin that changes requests refuses them when it fails', () => {
  render(<RequestPluginRunLine plugin={plugin(['outbound', 'reply'])} />)
  expect(screen.getByText('Refuses the request when it fails')).toBeVisible()
})

test('a plugin that only checks replies stops the reply when it fails', () => {
  render(<RequestPluginRunLine plugin={plugin(['reply'])} />)
  expect(screen.getByText('Stops the reply when it fails')).toBeVisible()
  expect(screen.queryByText('Refuses the request when it fails')).toBeNull()
})

test('an optional plugin is skipped when it fails', () => {
  render(<RequestPluginRunLine plugin={plugin(['reply'], true)} />)
  expect(screen.getByText('Skipped when it fails')).toBeVisible()
})

test('a plugin that only reports says nothing about failures', () => {
  render(<RequestPluginRunLine plugin={plugin(['report'])} />)
  expect(screen.getByText('After the request')).toBeVisible()
  expect(screen.queryByText(/when it fails/)).toBeNull()
})
