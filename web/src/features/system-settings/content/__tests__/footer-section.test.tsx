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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { FooterConfig } from '@/features/footer/types'

import { useUpdateOption } from '../../hooks/use-update-option'
import { FooterSection } from '../footer-section'

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: vi.fn(),
}))

const initialConfig: FooterConfig = {
  description: 'Initial description',
  socialLinks: [
    {
      id: 'github',
      label: 'GitHub',
      url: 'https://github.com/QuantumNous/new-api',
      icon: 'github',
    },
  ],
  columns: [
    {
      id: 'product',
      title: 'Product',
      links: [{ id: 'models', label: 'Models', url: '/#models' }],
    },
  ],
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('FooterSection', () => {
  test('edits both footer sides and saves one complete configuration', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ success: true, message: '' })
    vi.mocked(useUpdateOption).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateOption>)
    const user = userEvent.setup()

    render(<FooterSection data={JSON.stringify(initialConfig)} />)

    const description = screen.getByLabelText('Footer description')
    await user.clear(description)
    await user.type(description, 'Configurable gateway footer')

    await user.click(screen.getByRole('button', { name: 'Edit social link' }))
    let dialog = await screen.findByRole('dialog')
    const socialTitle = within(dialog).getByLabelText('Link title')
    await user.clear(socialTitle)
    await user.type(socialTitle, 'Source code')
    await user.click(within(dialog).getByRole('button', { name: 'Update' }))

    await user.click(screen.getByRole('button', { name: 'Add column' }))
    dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Column title'), 'Resources')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    const resourcesHeading = screen.getByRole('heading', {
      name: 'Resources',
    })
    const resourcesSection = resourcesHeading.closest('section')
    expect(resourcesSection).not.toBeNull()
    await user.click(
      within(resourcesSection as HTMLElement).getByRole('button', {
        name: 'Add footer link',
      })
    )
    dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Link title'), 'Status')
    await user.type(within(dialog).getByLabelText('Destination URL'), '/status')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(mutateAsync).toHaveBeenCalledOnce()
    const request = mutateAsync.mock.calls[0][0]
    expect(request.key).toBe('console_setting.footer')
    expect(JSON.parse(request.value)).toMatchObject({
      description: 'Configurable gateway footer',
      socialLinks: [{ label: 'Source code' }],
      columns: [
        { title: 'Product' },
        {
          title: 'Resources',
          links: [{ label: 'Status', url: '/status' }],
        },
      ],
    })
  }, 10_000)
})

test('adds multiple registrations with an uploaded icon, reorders and saves them', async () => {
  const mutateAsync = vi.fn().mockResolvedValue({ success: true })
  vi.mocked(useUpdateOption).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateOption>)
  const user = userEvent.setup()
  render(<FooterSection data={JSON.stringify(initialConfig)} />)
  await user.click(screen.getByRole('button', { name: 'Add registration' }))
  let dialog = await screen.findByRole('dialog')
  await user.type(
    within(dialog).getByLabelText('Registration text'),
    '京ICP备123号'
  )
  await user.type(
    within(dialog).getByLabelText('Destination URL'),
    'https://beian.miit.gov.cn/'
  )
  const file = new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    'icp.png',
    { type: 'image/png' }
  )
  await user.upload(within(dialog).getByLabelText('Icon'), file)
  await within(dialog).findByRole('button', { name: 'Clear' })
  await user.click(within(dialog).getByRole('button', { name: 'Add' }))
  await user.click(screen.getByRole('button', { name: 'Add registration' }))
  dialog = await screen.findByRole('dialog')
  await user.type(
    within(dialog).getByLabelText('Registration text'),
    '京公网安备456号'
  )
  await user.type(
    within(dialog).getByLabelText('Destination URL'),
    'https://beian.mps.gov.cn/'
  )
  await user.click(within(dialog).getByRole('button', { name: 'Add' }))
  const region = screen.getByRole('region', {
    name: 'Registration information',
  })
  await user.click(
    within(region).getAllByRole('button', { name: 'Move up' })[1]
  )
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  const saved = JSON.parse(mutateAsync.mock.calls[0][0].value)
  expect(saved.registrations.map((x: { label: string }) => x.label)).toEqual([
    '京公网安备456号',
    '京ICP备123号',
  ])
  expect(saved.registrations[1].icon).toMatch(/^data:image\/png;base64,/)
  expect(saved.columns).toEqual(initialConfig.columns)
})

test('edits and removes registration entries without changing other footer content', async () => {
  const mutateAsync = vi.fn().mockResolvedValue({ success: true })
  vi.mocked(useUpdateOption).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateOption>)
  const user = userEvent.setup()
  render(
    <FooterSection
      data={JSON.stringify({
        ...initialConfig,
        registrations: [
          {
            id: 'icp',
            label: 'Old registration',
            url: 'https://example.com',
            icon: '',
          },
        ],
      })}
    />
  )
  const region = screen.getByRole('region', {
    name: 'Registration information',
  })
  await user.click(within(region).getByRole('button', { name: 'Edit' }))
  const dialog = await screen.findByRole('dialog')
  const label = within(dialog).getByLabelText('Registration text')
  await user.clear(label)
  await user.type(label, 'Updated registration')
  await user.click(within(dialog).getByRole('button', { name: 'Update' }))
  expect(within(region).getByText('Updated registration')).toBeVisible()
  await user.click(within(region).getByRole('button', { name: 'Delete' }))
  const confirm = await screen.findByRole('alertdialog')
  await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  const saved = JSON.parse(mutateAsync.mock.calls[0][0].value)
  expect(saved.registrations).toEqual([])
  expect(saved.socialLinks).toEqual(initialConfig.socialLinks)
})
