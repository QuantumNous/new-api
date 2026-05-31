import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { Keys } from './keys'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: mockApi,
}))

const token = {
  id: 8,
  user_id: 2,
  key: '3kPG**********LcCM',
  status: 1,
  name: 'test',
  created_time: 1760000000,
  accessed_time: 0,
  expired_time: -1,
  remain_quota: 1000000,
  unlimited_quota: false,
  used_quota: 0,
  models: '',
  subnet: '',
  group: 'default',
}

describe('Keys page', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ items: [token], total: 1, page: 0, page_size: 20 })
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('shows the masked token from the list response', async () => {
    render(
      <I18nProvider>
        <Keys />
      </I18nProvider>,
    )

    expect(await screen.findByText('sk-3kPG**********LcCM')).toBeInTheDocument()
  })

  it('copies the full token from the token key endpoint', async () => {
    mockApi.post.mockResolvedValue({ key: 'testFullKeyValue1234567890abcdefghijklmnopqrstuvwxyz' })

    render(
      <I18nProvider>
        <Keys />
      </I18nProvider>,
    )

    await screen.findByText('sk-3kPG**********LcCM')
    fireEvent.click(screen.getByTitle('Copy'))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/token/8/key')
      expect(writeText).toHaveBeenCalledWith(
        'sk-testFullKeyValue1234567890abcdefghijklmnopqrstuvwxyz',
      )
    })
  })
})
