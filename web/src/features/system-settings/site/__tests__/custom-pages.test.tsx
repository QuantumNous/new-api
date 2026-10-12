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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import type { CustomPage } from '@/lib/custom-pages'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CustomPagesSection } from '../custom-pages-section'

const page = {
  name: 'Status',
  url: 'https://status.example.com',
  adminOnly: false,
  highlight: false,
}
const clients: QueryClient[] = []

function Fixture(props: { raw: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <CustomPagesSection defaultValue={props.raw} />
      </SettingsPageProvider>
    </>
  )
}
function renderSettings(pages: CustomPage[] = []) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  client.setQueryData(['custom-pages'], pages)
  render(
    <QueryClientProvider client={client}>
      <Fixture raw={JSON.stringify(pages)} />
    </QueryClientProvider>
  )
  return client
}

beforeEach(() => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
})

it('empty settings show an empty state and allow adding and removing rows', async () => {
  const user = userEvent.setup()
  renderSettings()
  expect(
    screen.getByText('No custom pages yet. Add one to show it in the sidebar.')
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add page' }))
  expect(screen.getByRole('textbox', { name: 'Menu name' })).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Remove page' }))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('editing a row and toggling restrictions saves the option and invalidates custom-page queries', async () => {
  const user = userEvent.setup()
  const client = renderSettings([page])
  const name = screen.getByRole('textbox', { name: 'Menu name' })
  await user.clear(name)
  await user.type(name, ' Status page ')
  await user.click(screen.getByRole('switch', { name: 'Admins only' }))
  await user.click(screen.getByRole('switch', { name: 'Highlight in sidebar' }))
  const color = screen.getByRole('combobox', { name: 'Highlight color' })
  await user.click(color)
  expect(color).toHaveAttribute('aria-expanded', 'true')
  await user.click(await screen.findByRole('option', { name: 'Purple' }))
  expect(color).toHaveTextContent('Purple')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'CustomPages',
      value: JSON.stringify([
        {
          ...page,
          name: 'Status page',
          adminOnly: true,
          highlight: true,
          highlightColor: 'purple',
        },
      ]),
    })
  )
  expect(client.getQueryState(['custom-pages'])?.isInvalidated).toBe(true)
})

it('disabling highlight retains the selected color for re-enabling', async () => {
  const user = userEvent.setup()
  renderSettings([{ ...page, highlight: true, highlightColor: 'green' }])
  const color = screen.getByRole('combobox', { name: 'Highlight color' })
  expect(color).toHaveTextContent('Green')
  await user.click(screen.getByRole('switch', { name: 'Highlight in sidebar' }))
  expect(color).toBeDisabled()
  expect(color).toHaveTextContent('Green')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'CustomPages',
      value: JSON.stringify([{ ...page, highlightColor: 'green' }]),
    })
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  )
  await user.click(screen.getByRole('switch', { name: 'Highlight in sidebar' }))
  expect(
    screen.getByRole('combobox', { name: 'Highlight color' })
  ).toBeEnabled()
  expect(
    screen.getByRole('combobox', { name: 'Highlight color' })
  ).toHaveTextContent('Green')
})

it('the color dropdown supports keyboard selection and returning to the theme default', async () => {
  const user = userEvent.setup()
  renderSettings([{ ...page, highlight: true }])
  const color = screen.getByRole('combobox', { name: 'Highlight color' })
  color.focus()
  await user.keyboard('{ArrowDown}')
  expect(await screen.findByRole('listbox')).toBeVisible()
  await user.keyboard('{End}{Enter}')
  expect(color).toHaveTextContent('Red')
  await user.click(color)
  await user.click(await screen.findByRole('option', { name: 'Follow theme' }))
  expect(color).toHaveTextContent('Follow theme')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'CustomPages',
      value: JSON.stringify([{ ...page, highlight: true }]),
    })
  )
})

it.each([
  ['Menu name', '', 'Name is required'],
  ['Menu name', 'a'.repeat(31), 'Name cannot exceed 30 characters'],
  ['URL', 'javascript:alert(1)', 'URL must start with http:// or https://'],
  ['URL', '/relative', 'URL must start with http:// or https://'],
  ['URL', '', 'URL is required'],
])(
  'invalid %s value "%s" shows a field error and blocks saving',
  async (label, value, error) => {
    renderSettings([page])
    const input = screen.getByRole('textbox', { name: label })
    fireEvent.change(input, { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText(error)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(api.put).not.toHaveBeenCalled()
  }
)

it('duplicate names differing only in case cannot be saved', async () => {
  renderSettings([page, { ...page, name: 'Other' }])
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Menu name' })[1], {
    target: { value: ' status ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(
    await screen.findByText('Menu names must be unique')
  ).toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})

it('20 pages disable adding until a page is removed', async () => {
  const user = userEvent.setup()
  renderSettings(
    Array.from({ length: 20 }, (_, i) => ({ ...page, name: `Page ${i}` }))
  )
  expect(screen.getByRole('button', { name: 'Add page' })).toBeDisabled()
  await user.click(screen.getAllByRole('button', { name: 'Remove page' })[0])
  expect(screen.getByRole('button', { name: 'Add page' })).toBeEnabled()
})

it('failed saves preserve edits and leave the custom-page cache valid', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: false, message: 'Rejected' },
  })
  const client = renderSettings([page])
  const input = screen.getByRole('textbox', { name: 'Menu name' })
  fireEvent.change(input, { target: { value: 'Changed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(api.put).toHaveBeenCalled())
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  )
  expect(input).toHaveValue('Changed')
  expect(client.getQueryState(['custom-pages'])?.isInvalidated).toBe(false)
})

it('removing the final configured page saves an empty array', async () => {
  const user = userEvent.setup()
  renderSettings([page])
  await user.click(screen.getByRole('button', { name: 'Remove page' }))
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'CustomPages',
      value: '[]',
    })
  )
})
