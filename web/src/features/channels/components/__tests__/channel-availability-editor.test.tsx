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
import { describe, expect, test } from 'vitest'

import { Form } from '@/components/ui/form'

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  type ChannelFormValues,
} from '../../lib/channel-form'
import { ChannelAvailabilityEditor } from '../channel-availability-editor'

function AvailabilityForm(props: {
  disabled?: boolean
  windows?: ChannelFormValues['availability_windows']
}) {
  const form = useForm<ChannelFormValues>({
    defaultValues: {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      availability_windows: props.windows ?? [],
    },
  })
  return (
    <Form {...form}>
      <ChannelAvailabilityEditor disabled={props.disabled} />
    </Form>
  )
}

describe('ChannelAvailabilityEditor', () => {
  test('a channel without windows shows only the add button', () => {
    render(<AvailabilityForm />)
    expect(screen.getByRole('button', { name: 'Add window' })).toBeEnabled()
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument()
  })

  test('adding a window reveals its start, end, timezone and weekday controls', async () => {
    const user = userEvent.setup()
    render(<AvailabilityForm />)

    await user.click(screen.getByRole('button', { name: 'Add window' }))

    expect(screen.getByText('Window {{index}}'.replace('{{index}}', '1'))).toBeVisible()
    expect(screen.getByText('Timezone')).toBeVisible()
    expect(screen.getByText('Start')).toBeVisible()
    expect(screen.getByText('End')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Mon' })
    ).toBeVisible()
  })

  test('selecting a weekday marks it pressed and removing the window hides it', async () => {
    const user = userEvent.setup()
    render(<AvailabilityForm />)

    await user.click(screen.getByRole('button', { name: 'Add window' }))
    await user.click(screen.getByRole('button', { name: 'Mon' }))
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Remove window' }))
    expect(screen.queryByText(/Window/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument()
  })

  test('a disabled editor keeps the add button disabled', () => {
    render(<AvailabilityForm disabled />)
    expect(screen.getByRole('button', { name: 'Add window' })).toBeDisabled()
  })
})
