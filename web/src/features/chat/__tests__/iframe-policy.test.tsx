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
import { createElement, type ComponentType } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { Route as ChatRoute } from '@/routes/_authenticated/chat/$chatId'

const SCRIPT_APP_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-presentation'

const mocks = vi.hoisted(() => ({
  chatId: '0',
  chatPresets: [] as Array<{
    id: string
    name: string
    type: 'web'
    url: string
  }>,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  createFileRoute:
    () =>
    (options: Record<string, unknown>): Record<string, unknown> => ({
      options,
      useParams: () => ({ chatId: mocks.chatId }),
    }),
  redirect: vi.fn(),
}))

vi.mock('@/features/chat/hooks/use-active-chat-key', () => ({
  useActiveChatKey: () => ({
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
  }),
}))

vi.mock('@/features/chat/hooks/use-chat-presets', () => ({
  useChatPresets: () => ({
    chatPresets: mocks.chatPresets,
    serverAddress: window.location.origin,
  }),
}))

beforeEach(() => {
  mocks.chatId = '0'
  mocks.chatPresets = []
})

function renderChatPreset(url: string): HTMLIFrameElement {
  mocks.chatPresets = [
    {
      id: '0',
      name: 'Policy Test',
      type: 'web',
      url,
    },
  ]
  const ChatComponent = ChatRoute.options.component as ComponentType

  render(createElement(ChatComponent))

  return screen.getByTitle('Chat preset: Policy Test')
}

test.each([
  ['same-origin HTTP URL', `${window.location.origin}/canvas`],
  ['cross-origin HTTPS URL', 'https://canvas.example.test/'],
  ['relative URL', '/canvas'],
])('chat preset accepts %s without same-origin privileges', (_name, url) => {
  const iframe = renderChatPreset(url)

  expect(iframe).toHaveAttribute('src', url)
  expect(iframe).toHaveAttribute('sandbox', SCRIPT_APP_SANDBOX)
})

test.each([
  ['blob URL', `blob:${window.location.origin}/canvas-id`],
  ['data URL', 'data:text/html,<h1>unsafe</h1>'],
  ['JavaScript URL', 'javascript:alert(1)'],
  ['about URL', 'about:blank'],
  ['malformed URL', 'http://[invalid'],
])('chat preset blocks a %s', (_name, url) => {
  const iframe = renderChatPreset(url)

  expect(iframe).not.toHaveAttribute('src')
  expect(iframe).toHaveAttribute('sandbox', SCRIPT_APP_SANDBOX)
})
