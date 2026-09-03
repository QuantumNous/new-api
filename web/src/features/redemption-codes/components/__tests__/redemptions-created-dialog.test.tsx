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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const i18n = (await import('i18next')).default
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { Toaster, toast } = await import('sonner')
const { api } = await import('@/lib/api')
const { RedemptionsProvider, useRedemptions } =
  await import('../redemptions-provider')
const { RedemptionsDialogs } = await import('../redemptions-dialogs')

await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Close: 'Close',
        'Copied {{count}} code(s)': 'Copied {{count}} code(s)',
        'Copy All': 'Copy All',
        'Copy redemption code {{index}}': 'Copy redemption code {{index}}',
        'Failed to copy to clipboard': 'Failed to copy to clipboard',
        'Redemption code(s) created successfully':
          'Redemption code(s) created successfully',
        'Successfully created {{count}} redemption codes':
          'Successfully created {{count}} redemption codes',
      },
    },
  },
})

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalPost = apiClient.post
let writeText: ReturnType<typeof vi.fn>

/** Opens the create drawer so the real create -> created-dialog flow can run. */
function OpenCreateDrawer() {
  const { setOpen } = useRedemptions()
  return (
    <button type='button' onClick={() => setOpen('create')}>
      open-create
    </button>
  )
}

function renderDialogs() {
  return render(
    <I18nextProvider i18n={i18n}>
      <RedemptionsProvider>
        <OpenCreateDrawer />
        <RedemptionsDialogs />
      </RedemptionsProvider>
      <Toaster duration={60_000} />
    </I18nextProvider>
  )
}

/** The dialog chrome also renders an sr-only "Close", so scope to the footer. */
function footerButton(name: string) {
  const footer = document.querySelector('[data-slot=dialog-footer]')
  if (!footer) throw new Error('Expected the created dialog footer')
  return within(footer as HTMLElement).getByRole('button', { name })
}

/** Submits the create form, which is prefilled with a valid quota and count. */
async function createCodes(codes: string[], count = codes.length) {
  apiClient.post = async () => ({ data: { success: true, data: codes } })

  fireEvent.click(screen.getByRole('button', { name: 'open-create' }))

  const countInput = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('input[max="100"]')
    if (!input) throw new Error('Expected the quantity input')
    return input
  })
  fireEvent.input(countInput, { target: { value: String(count) } })

  const form = document.querySelector<HTMLFormElement>('#redemption-form')
  if (!form) throw new Error('Expected the redemption form')
  fireEvent.submit(form)
}

beforeEach(() => {
  writeText = vi.fn(async () => undefined)
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  })
})

afterEach(() => {
  apiClient.post = originalPost
  vi.unstubAllGlobals()
  toast.dismiss()
})

describe('redemption created dialog', () => {
  test('lists every created code after a successful create', async () => {
    renderDialogs()
    await createCodes(['code-aaa', 'code-bbb', 'code-ccc'])

    await waitFor(() =>
      expect(
        screen.getByText('Successfully created 3 redemption codes')
      ).toBeInTheDocument()
    )
    expect(screen.getByText('code-aaa')).toBeInTheDocument()
    expect(screen.getByText('code-bbb')).toBeInTheDocument()
    expect(screen.getByText('code-ccc')).toBeInTheDocument()
  })

  test('copies all codes newline-separated when Copy All is pressed', async () => {
    renderDialogs()
    await createCodes(['code-aaa', 'code-bbb'])

    fireEvent.click(await screen.findByRole('button', { name: 'Copy All' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith('code-aaa\ncode-bbb')
  })

  test('copies only the selected code from its per-row button', async () => {
    renderDialogs()
    await createCodes(['code-aaa', 'code-bbb'])

    fireEvent.click(
      await screen.findByRole('button', { name: 'Copy redemption code 2' })
    )

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith('code-bbb')
  })

  test('gives each code copy button a distinct accessible name', async () => {
    renderDialogs()
    await createCodes(['code-aaa', 'code-bbb'])

    expect(
      await screen.findByRole('button', { name: 'Copy redemption code 1' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy redemption code 2' })
    ).toBeInTheDocument()
  })

  test('uses the singular title when a single code is created', async () => {
    renderDialogs()
    await createCodes(['code-only'])

    await waitFor(() =>
      expect(
        screen.getByText('Redemption code(s) created successfully')
      ).toBeInTheDocument()
    )
    expect(
      screen.queryByText('Successfully created 1 redemption codes')
    ).not.toBeInTheDocument()
  })

  test('dismisses the dialog and its codes when Close is pressed', async () => {
    const user = userEvent.setup()
    renderDialogs()
    await createCodes(['code-aaa'])
    await screen.findByText('code-aaa')

    await user.click(footerButton('Close'))

    await waitFor(() =>
      expect(screen.queryByText('code-aaa')).not.toBeInTheDocument()
    )
  })

  test('reports a failure and keeps the dialog open when copying is rejected', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    vi.stubGlobal('document', document)
    Reflect.set(document, 'execCommand', () => false)

    renderDialogs()
    await createCodes(['code-aaa'])

    fireEvent.click(await screen.findByRole('button', { name: 'Copy All' }))

    await waitFor(() =>
      expect(document.body).toHaveTextContent('Failed to copy to clipboard')
    )
    expect(screen.getByText('code-aaa')).toBeInTheDocument()
  })
})
