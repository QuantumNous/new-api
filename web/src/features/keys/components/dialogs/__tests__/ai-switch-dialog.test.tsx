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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AISwitchDialog } from '../ai-switch-dialog'

let queryClient: QueryClient
let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  queryClient.clear()
  openSpy.mockRestore()
})

function renderDialog(tokenKey = 'test-only') {
  queryClient.setQueryData(['user-models-aiswitch'], {
    success: true,
    data: ['gpt-5.4', 'claude-sonnet-4-6'],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AISwitchDialog open onOpenChange={vi.fn()} tokenKey={tokenKey} />
    </QueryClientProvider>
  )
}

function submittedURL(): URL {
  expect(openSpy).toHaveBeenCalledTimes(1)
  const url = openSpy.mock.calls[0][0] as string
  expect(url.startsWith('aiswitch://v1/import?')).toBe(true)
  return new URL(url)
}

describe('AI Switch deep link import', () => {
  it('builds a Claude link with no model mappings by default', async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open AI Switch' }))

    const url = submittedURL()
    const params = url.searchParams
    expect(params.get('resource')).toBe('provider')
    expect(params.get('app')).toBe('claude')
    expect(params.get('name')).toBe('My Claude')
    expect(params.get('endpoint')).toBe(window.location.origin)
    expect(params.get('apiKey')).toBe('sk-test-only')
    expect(params.get('homepage')).toBe(window.location.origin)
    expect(params.get('model')).toBeNull()
    expect(params.get('haikuModel')).toBeNull()
    expect(params.get('sonnetModel')).toBeNull()
    expect(params.get('opusModel')).toBeNull()
  })

  it('prefixes the token key with sk- only when missing', async () => {
    renderDialog('abc')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open AI Switch' }))
    expect(submittedURL().searchParams.get('apiKey')).toBe('sk-abc')
  })

  it('uses a /v1 endpoint for Codex and forwards the selected model', async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Codex' }))
    const input = screen.getByRole('combobox', { name: 'Primary Model' })
    await user.click(input)
    await user.click(await screen.findByRole('option', { name: 'gpt-5.4' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open AI Switch' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Open AI Switch' }))

    const params = submittedURL().searchParams
    expect(params.get('app')).toBe('codex')
    expect(params.get('endpoint')).toBe(`${window.location.origin}/v1`)
    expect(params.get('model')).toBe('gpt-5.4')
  })

  it('sends role models for Claude and trims the provider name with a fallback', async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Claude' }))
    const nameInput = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(nameInput)
    await user.type(nameInput, '  Dev Relay  ')
    const sonnet = screen.getByRole('combobox', { name: 'Sonnet Model' })
    await user.click(sonnet)
    await user.click(
      await screen.findByRole('option', { name: 'claude-sonnet-4-6' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open AI Switch' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Open AI Switch' }))

    const params = submittedURL().searchParams
    expect(params.get('name')).toBe('Dev Relay')
    expect(params.get('sonnetModel')).toBe('claude-sonnet-4-6')
    expect(params.get('haikuModel')).toBeNull()
    expect(params.get('opusModel')).toBeNull()
    expect(params.get('model')).toBeNull()
  })
})
