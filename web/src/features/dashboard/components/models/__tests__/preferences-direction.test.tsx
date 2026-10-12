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
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'

import { DEFAULT_DASHBOARD_CHART_PREFERENCES } from '../../../constants'
import { ModelsChartPreferences } from '../models-chart-preferences'

afterEach(() => {
  cleanup()
})

it('keeps the preferences and save icons at the inline start of their buttons', async () => {
  render(
    <ModelsChartPreferences
      preferences={DEFAULT_DASHBOARD_CHART_PREFERENCES}
      onPreferencesChange={() => undefined}
    />
  )

  const open = screen.getByRole('button', { name: 'Preferences' })
  expect(open.querySelector('svg')).toHaveClass('me-2')
  expect(open.querySelector('svg')).not.toHaveClass('mr-2')

  await userEvent.click(open)
  const save = await screen.findByRole('button', { name: 'Save Preferences' })
  expect(save.querySelector('svg')).toHaveClass('me-2')
  expect(save.querySelector('svg')).not.toHaveClass('mr-2')
})
