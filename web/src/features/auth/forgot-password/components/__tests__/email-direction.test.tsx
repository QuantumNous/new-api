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

import { ForgotPasswordForm } from '../forgot-password-form'

it('keeps the email address input left to right on a right-to-left page', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <div dir='rtl'>
        <ForgotPasswordForm />
      </div>
    </QueryClientProvider>
  )

  expect(screen.getByPlaceholderText('name@example.com')).toHaveAttribute(
    'dir',
    'ltr'
  )
})
