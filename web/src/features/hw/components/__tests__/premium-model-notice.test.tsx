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
import { expect, test } from 'vitest'

import { PremiumModelNotice } from '../premium-model-notice'

test('shows the notice for Fable with Opus as the cheaper model', () => {
  render(<PremiumModelNotice language='tr' model='claude-fable-5-1' />)

  expect(screen.getByTestId('hw-premium-notice')).toHaveTextContent(
    'Bu model kredinizi çok daha hızlı tüketir. Bir alt model, claude-opus-5-5, çok daha ucuz ve neredeyse aynı kalitede.'
  )
})

test('shows nothing for Sonnet or an unknown model', () => {
  const { container } = render(
    <>
      <PremiumModelNotice language='en' model='claude-sonnet-5-5' />
      <PremiumModelNotice language='en' model='something-else' />
      <PremiumModelNotice language='en' model={undefined} />
    </>
  )

  expect(screen.queryByTestId('hw-premium-notice')).toBeNull()
  expect(container).toBeEmptyDOMElement()
})
