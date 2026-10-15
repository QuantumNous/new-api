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
import { cleanup, render } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, expect, test } from 'vitest'

import { Form, FormField, FormItem, FormMessage } from '../form'

afterEach(cleanup)

function BalanceScriptError() {
  const form = useForm({
    defaultValues: { balance_script: '' },
    errors: {
      balance_script: {
        type: 'custom',
        message: 'Balance script exceeds {{max}} bytes',
      },
    },
  })
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name='balance_script'
        render={() => (
          <FormItem>
            <FormMessage translationValues={{ max: 32768 }} />
          </FormItem>
        )}
      />
    </Form>
  )
}

test('interpolates the byte limit in a balance script validation message', () => {
  const { getByText, container } = render(<BalanceScriptError />)
  expect(getByText('Balance script exceeds 32768 bytes')).toBeVisible()
  expect(container.textContent).not.toContain('{{max}}')
})
