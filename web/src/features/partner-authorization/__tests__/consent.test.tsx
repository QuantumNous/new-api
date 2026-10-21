/*
Copyright (C) 2023-2026 QuantumNous
*/
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PartnerAuthorization } from '..'
import { decidePartnerAuthorization, getPartnerAuthorization } from '../api'

vi.mock('../api', () => ({
  getPartnerAuthorization: vi.fn(),
  decidePartnerAuthorization: vi.fn(),
}))

const getMock = vi.mocked(getPartnerAuthorization)
const decideMock = vi.mocked(decidePartnerAuthorization)

const view = {
  client_name: 'Example Assistant',
  client_id: 'pc_abc',
  scopes: ['account:read', 'credential:read', 'offline_access'],
  redirect_host: 'assistant.example.com',
  grant_expires_at: '2026-11-09T00:00:00Z',
  active_binding_limit_reached: false,
}

describe('PartnerAuthorization', () => {
  beforeEach(() => {
    getMock.mockReset()
    decideMock.mockReset()
    Object.defineProperty(window, 'self', { value: window, configurable: true })
    Object.defineProperty(window, 'top', { value: window, configurable: true })
  })

  it('shows a loading state until the request is fetched', () => {
    getMock.mockReturnValue(new Promise(() => undefined))
    render(<PartnerAuthorization request='req_1' />)
    expect(screen.getByText('Loading...')).toBeVisible()
  })

  it('approves the loaded request and navigates without a referrer', async () => {
    getMock.mockResolvedValue(view)
    decideMock.mockResolvedValue({
      redirect_to: 'https://assistant.example.com/oauth/callback?code=1',
    })
    const click = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((
      tag: string,
      options?: ElementCreationOptions
    ) => {
      if (tag === 'a') {
        return {
          href: '',
          referrerPolicy: '',
          rel: '',
          click,
        } as unknown as HTMLAnchorElement
      }
      return originalCreateElement(tag, options)
    }) as typeof document.createElement)
    const user = userEvent.setup()
    render(<PartnerAuthorization request='req_1' />)
    expect(
      await screen.findByText(
        'Example Assistant wants to connect to your account and call models with your balance.'
      )
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith('req_1', 'approve')
    )
    expect(click).toHaveBeenCalled()
  })

  it('lets the user deny without granting access', async () => {
    getMock.mockResolvedValue(view)
    decideMock.mockResolvedValue({
      redirect_to:
        'https://assistant.example.com/oauth/callback?error=access_denied',
    })
    const user = userEvent.setup()
    render(<PartnerAuthorization request='req_1' />)
    await screen.findByRole('button', { name: 'Deny' })
    await user.click(screen.getByRole('button', { name: 'Deny' }))
    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith('req_1', 'deny')
    )
  })

  it('shows an error when the request cannot be loaded', async () => {
    getMock.mockRejectedValue(new Error('expired'))
    render(<PartnerAuthorization request='req_1' />)
    expect(
      await screen.findByText('Please restart authorization from the app')
    ).toBeVisible()
  })

  it('blocks approval when the page is framed', () => {
    Object.defineProperty(window, 'self', {
      value: {},
      configurable: true,
    })
    render(<PartnerAuthorization request='req_1' />)
    expect(
      screen.getByText('This page cannot be opened in a frame')
    ).toBeVisible()
    expect(getMock).not.toHaveBeenCalled()
  })
})
