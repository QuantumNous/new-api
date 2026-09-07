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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { UploadDialog } from '../components/upload-dialog'
import { MAX_PLUGIN_SOURCE_BYTES } from '../lib/plugin-url'

const uploadTaskPlugin = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({ uploadTaskPlugin }))

const queryClients: QueryClient[] = []

function renderDialog(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  })
  queryClients.push(queryClient)
  const onOpenChange = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <UploadDialog open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return { onOpenChange, queryClient, view }
}

function sourceEditor() {
  return screen.getByRole('textbox', { name: 'Plugin source' })
}

function fileInput() {
  return screen.getByLabelText('JavaScript file') as HTMLInputElement
}

/** The dialog chrome also renders an sr-only "Close", so scope to the footer. */
function footerButton(name: string | RegExp) {
  const footer = document.querySelector('[data-slot=dialog-footer]')
  return within(footer as HTMLElement).getByRole('button', { name })
}

afterEach(() => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.length = 0
  vi.unstubAllGlobals()
})

describe('UploadDialog layout', () => {
  test('renders the source editor and hides the native file input from view', () => {
    renderDialog()

    expect(sourceEditor()).toBeInTheDocument()
    // The unstyled native picker is the element that made this dialog look
    // foreign; it must stay in the DOM (labelled) but never be the visible
    // control.
    expect(fileInput()).toHaveClass('sr-only')
    expect(
      screen.getByRole('button', { name: 'Choose file' })
    ).toBeInTheDocument()
    expect(screen.getByText('0 bytes')).toBeInTheDocument()
  })

  test('scrolls its body instead of growing past the viewport', () => {
    renderDialog()

    const content = document.querySelector('[data-slot=dialog-content]')
    const body = content?.querySelector(':scope > div:nth-child(2)')
    expect(content).toHaveClass('max-h-[calc(100vh-2rem)]')
    expect(body).toHaveClass('overflow-y-auto')
  })

  test('does not steal focus into the mid-dialog source editor on open', () => {
    renderDialog()

    expect(document.querySelector('.cm-content')).not.toHaveFocus()
  })
})

describe('UploadDialog file selection', () => {
  test('fills the source editor and names the chosen file', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.upload(
      fileInput(),
      new File(['export const meta = {}'], 'plugin.js', {
        type: 'text/javascript',
      })
    )

    expect(await screen.findByText('plugin.js')).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelector('.cm-content')?.textContent).toContain(
        'export const meta = {}'
      )
    )
    expect(
      screen.getByRole('button', { name: 'Choose another file' })
    ).toBeInTheDocument()
  })

  test('rejects a file over the 1 MiB limit without touching the source', async () => {
    const user = userEvent.setup()
    renderDialog()

    const oversized = new File(['x'], 'huge.js', { type: 'text/javascript' })
    Object.defineProperty(oversized, 'size', {
      value: MAX_PLUGIN_SOURCE_BYTES + 1,
    })
    await user.upload(fileInput(), oversized)

    expect(
      await screen.findByText('Plugin source exceeds the 1 MiB limit.')
    ).toBeInTheDocument()
    expect(screen.queryByText('huge.js')).toBeNull()
    expect(footerButton('Upload')).toBeDisabled()
  })
})

describe('UploadDialog URL import', () => {
  test('keeps Fetch disabled until a URL is typed, then fills the source', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('const fetched = 1', { status: 200 }))
    )
    renderDialog()

    expect(screen.getByRole('button', { name: 'Fetch' })).toBeDisabled()

    await user.type(
      screen.getByLabelText('Import from URL'),
      'https://example.com/plugin.js'
    )
    expect(screen.getByRole('button', { name: 'Fetch' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Fetch' }))

    await waitFor(() =>
      expect(document.querySelector('.cm-content')?.textContent).toContain(
        'const fetched = 1'
      )
    )
    // Fetching must never upload on its own.
    expect(uploadTaskPlugin).not.toHaveBeenCalled()
  })

  test('fetches on Enter and marks the field invalid when the URL is not absolute', async () => {
    const user = userEvent.setup()
    renderDialog()

    const urlField = screen.getByLabelText('Import from URL')
    await user.type(urlField, 'plugin.js{Enter}')

    expect(
      await screen.findByText('Enter an absolute http(s) URL.')
    ).toBeInTheDocument()
    expect(urlField).toHaveAttribute('aria-invalid', 'true')
    expect(document.querySelector('[data-slot=field-error]')).toHaveAttribute(
      'role',
      'alert'
    )
  })
})

describe('UploadDialog upload lifecycle', () => {
  test('disables Upload while the source is empty and shows a pending label', async () => {
    const user = userEvent.setup()
    let resolveUpload: (value: unknown) => void = () => undefined
    uploadTaskPlugin.mockImplementation(
      () => new Promise((resolve) => (resolveUpload = resolve))
    )
    renderDialog()

    expect(footerButton('Upload')).toBeDisabled()

    await user.upload(
      fileInput(),
      new File(['const a = 1'], 'plugin.js', { type: 'text/javascript' })
    )
    const uploadButton = await waitFor(() => {
      const button = footerButton('Upload')
      expect(button).toBeEnabled()
      return button
    })

    await user.click(uploadButton)
    await waitFor(() => expect(footerButton(/Uploading/)).toBeDisabled())

    resolveUpload({
      source: 'const a = 1',
      meta: { key: 'demo', name: 'Demo', version: '1.0.0', apiVersion: 1 },
    })
    expect(
      await screen.findByText('Parsed plugin metadata')
    ).toBeInTheDocument()
  })

  test('surfaces an upload rejection verbatim', async () => {
    const user = userEvent.setup()
    uploadTaskPlugin.mockRejectedValue(new Error('key conflicts with `demo`'))
    renderDialog()

    await user.upload(
      fileInput(),
      new File(['const a = 1'], 'plugin.js', { type: 'text/javascript' })
    )
    await waitFor(() => expect(footerButton('Upload')).toBeEnabled())
    await user.click(footerButton('Upload'))

    expect(
      await screen.findByText('key conflicts with `demo`')
    ).toBeInTheDocument()
  })

  test('clears every field when the dialog is closed', async () => {
    const user = userEvent.setup()
    const { onOpenChange, queryClient, view } = renderDialog()

    await user.upload(
      fileInput(),
      new File(['const a = 1'], 'plugin.js', { type: 'text/javascript' })
    )
    await user.type(screen.getByLabelText('Import from URL'), 'plugin.js')
    await screen.findByText('plugin.js')

    await user.click(footerButton('Close'))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <UploadDialog open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText('Import from URL')).toHaveValue('')
    expect(screen.getByText('0 bytes')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Choose file' })
    ).toBeInTheDocument()
  })
})
