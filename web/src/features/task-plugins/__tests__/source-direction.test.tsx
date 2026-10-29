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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { PluginUrlImportField } from '../components/plugin-url-import-field'
import { SourceDiff } from '../components/source-diff'

it('keeps the source diff left to right on a right-to-left page, so code lines and +/- markers stay in order', () => {
  render(
    <div dir='rtl'>
      <SourceDiff before={'const a = 1\n'} after={'const a = 2\n'} />
    </div>
  )

  expect(screen.getByLabelText('Source diff')).toHaveAttribute('dir', 'ltr')
})

it('keeps the plugin URL input left to right on a right-to-left page', () => {
  const queryClient = new QueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <div dir='rtl'>
        <PluginUrlImportField
          value=''
          onChange={() => {}}
          error=''
          onError={() => {}}
          onFetched={() => {}}
        />
      </div>
    </QueryClientProvider>
  )

  expect(screen.getByRole('textbox')).toHaveAttribute('dir', 'ltr')
})
