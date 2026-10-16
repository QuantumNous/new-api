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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { SystemInfoSection } from '../system-info-section'

function Fixture(props: {
  initialLanguage: 'auto' | 'zhTW'
  initialQRCode?: string
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <SystemInfoSection
          defaultValues={{
            SystemName: 'New API',
            ServerAddress: '',
            TaskPublicAddress: '',
            Logo: '',
            general_setting: { docs_link: '' },
            legal: {},
            console_setting: {
              default_language: props.initialLanguage,
              home_business_qrcode: props.initialQRCode,
            },
          }}
        />
      </SettingsPageProvider>
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

test.each([
  ['auto', 'zhTW', '繁體中文'],
  ['zhTW', 'auto', 'Follow system / browser language'],
] as const)(
  'changes the default from %s to %s and offers all supported languages',
  async (initialLanguage, value, label) => {
    const user = userEvent.setup()
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => <Fixture initialLanguage={initialLanguage} />,
      }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    const input = await screen.findByRole('combobox', {
      name: 'Site default language',
    })
    expect(input).toHaveValue(
      initialLanguage === 'auto'
        ? 'Follow system / browser language'
        : '繁體中文'
    )
    await user.click(input)
    for (const name of [
      '简体中文',
      'English',
      'Français',
      'Русский',
      '日本語',
      'Tiếng Việt',
      '繁體中文',
    ]) {
      expect(await screen.findByRole('option', { name })).toBeVisible()
    }
    await user.click(screen.getByRole('option', { name: label }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/option/', {
        key: 'console_setting.default_language',
        value,
      })
    )
    client.clear()
  }
)

test('saves the domestic globe filter through the existing settings API', async () => {
  const user = userEvent.setup()
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <Fixture initialLanguage='auto' />,
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const toggle = await screen.findByRole('switch', {
    name: 'Show only Chinese models on the homepage globe',
  })
  expect(toggle).not.toBeChecked()
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'console_setting.home_globe_domestic_only',
      value: 'true',
    })
  )
  client.clear()
})

test.each(['upload', 'remove'])(
  '%s the business QR code through site settings',
  async (action) => {
    const user = userEvent.setup()
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => (
          <Fixture
            initialLanguage='auto'
            initialQRCode={
              action === 'remove' ? 'https://example.com/qr.png' : ''
            }
          />
        ),
      }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    if (action === 'upload') {
      await user.click(
        await screen.findByRole('button', { name: 'Add contact channel' })
      )
      await user.type(
        screen.getByRole('textbox', { name: 'Channel label' }),
        'Sales'
      )
    }
    const input = await screen.findByLabelText('QR code image', {
      selector: 'input[type="file"]',
    })
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    if (action === 'upload') {
      await user.upload(
        input,
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'too-large.png', {
          type: 'image/png',
        })
      )
      expect(
        screen.queryByRole('img', { name: 'QR code image' })
      ).not.toBeInTheDocument()
      await user.upload(
        input,
        new File(
          [Uint8Array.from(atob(image.split(',')[1]), (c) => c.charCodeAt(0))],
          'qr.png',
          { type: 'image/png' }
        )
      )
      expect(
        await screen.findByRole('img', { name: 'QR code image' })
      ).toHaveAttribute('src', image)
      await user.click(
        screen.getByRole('button', { name: 'Add contact channel' })
      )
      const second = within(
        screen.getByRole('group', { name: 'Contact channel 2' })
      )
      await user.type(
        second.getByRole('textbox', { name: 'Channel label' }),
        'Telegram'
      )
      await user.upload(
        second.getByLabelText('QR code image', {
          selector: 'input[type="file"]',
        }),
        new File(
          [Uint8Array.from(atob(image.split(',')[1]), (c) => c.charCodeAt(0))],
          'telegram.png',
          { type: 'image/png' }
        )
      )
      expect(
        await second.findByRole('img', { name: 'QR code image' })
      ).toHaveAttribute('src', image)
    } else {
      await user.click(screen.getByRole('button', { name: 'Remove channel' }))
      expect(
        screen.queryByRole('img', { name: 'QR code image' })
      ).not.toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/option/', {
        key: 'console_setting.home_business_qrcode',
        value: expect.any(String),
      })
    )
    const saved = put.mock.calls[0][1] as { value: string }
    expect(JSON.parse(saved.value)).toEqual(
      action === 'upload'
        ? [
            { id: expect.any(String), label: 'Sales', image },
            { id: expect.any(String), label: 'Telegram', image },
          ]
        : []
    )
    client.clear()
  }
)
