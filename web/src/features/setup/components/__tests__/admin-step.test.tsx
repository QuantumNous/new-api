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
import { useForm } from 'react-hook-form'
import { expect, it } from 'vitest'

import { Form } from '@/components/ui/form'

import type { SetupFormValues } from '../../types'
import { AdminStep } from '../admin-step'

function AdminStepFixture() {
  const form = useForm<SetupFormValues>({
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      usageMode: 'external',
    },
  })

  return (
    <Form {...form}>
      <AdminStep form={form} />
    </Form>
  )
}

it('a mismatched administrator password confirmation is announced on the confirmation field', async () => {
  const user = userEvent.setup()
  render(<AdminStepFixture />)

  await user.type(screen.getByLabelText('Password'), 'Forest7!Lake')
  await user.type(screen.getByLabelText('Confirm password'), 'Forest7!Lakes')

  expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription(
    expect.stringContaining('Passwords do not match')
  )
})
