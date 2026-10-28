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

import { CompanyFooterDetails } from '../company-footer-details'

test('company footer displays the complete office address', () => {
  render(<CompanyFooterDetails />)
  expect(
    screen.getByText('深圳市宝安区航城街道九围社区丁圳路11号顺兴管理处')
  ).toBeInTheDocument()
})

test('company footer shows contact phone and email', () => {
  render(<CompanyFooterDetails />)
  expect(screen.getByText(/18688669114/)).toHaveAttribute(
    'href',
    'tel:18688669114'
  )
  expect(screen.getByText(/support@tokeninfra\.com/)).toHaveAttribute(
    'href',
    'mailto:support@tokeninfra.com'
  )
})
