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
import { describe, expect, it } from 'vitest'

import { MultiSelect } from '@/components/multi-select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const options = [
  { value: 'default', label: 'default' },
  { value: 'vip', label: 'vip' },
]

const DESCRIPTION =
  'Subscription quota only applies to these groups; requests in other groups use wallet balance.'

function FormFixture() {
  const form = useForm({ defaultValues: { groups: [] as string[] } })

  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name='groups'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quota Usable Groups</FormLabel>
              <FormControl>
                <MultiSelect
                  options={options}
                  selected={field.value}
                  onChange={field.onChange}
                  placeholder='Empty = all groups'
                  aria-label='Quota Usable Groups'
                />
              </FormControl>
              <FormDescription>{DESCRIPTION}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type='button'
          onClick={() =>
            form.setError('groups', { type: 'manual', message: 'Group required' })
          }
        >
          Trigger error
        </button>
      </form>
    </Form>
  )
}

describe('MultiSelect form accessibility', () => {
  it('takes its accessible name from the form label, not the placeholder', () => {
    render(<FormFixture />)

    expect(
      screen.getByRole('combobox', { name: 'Quota Usable Groups' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Empty = all groups' })
    ).not.toBeInTheDocument()
  })

  it('links the form description to the input', () => {
    render(<FormFixture />)

    const input = screen.getByRole('combobox', { name: 'Quota Usable Groups' })
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const description = document.getElementById(describedBy!.split(' ')[0])
    expect(description).toHaveTextContent(DESCRIPTION)
  })

  it('marks the input invalid and links the error message', async () => {
    render(<FormFixture />)

    await userEvent.click(screen.getByRole('button', { name: 'Trigger error' }))

    const input = screen.getByRole('combobox', { name: 'Quota Usable Groups' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const message = screen.getByText('Group required')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toContain(message.id)
  })

  it('keeps the placeholder as accessible name when standalone', () => {
    render(
      <MultiSelect
        options={options}
        selected={[]}
        onChange={() => {}}
        placeholder='Pick groups'
      />
    )

    expect(
      screen.getByRole('combobox', { name: 'Pick groups' })
    ).toBeInTheDocument()
  })
})
