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
import * as React from 'react'
import * as reactQueryModule from '@tanstack/react-query'
import * as reactRouterModule from '@tanstack/react-router'
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as authStoreModule from '@/stores/auth-store'
import * as onboardingStoreModule from '@/stores/onboarding-store'
import * as enterpriseModule from '@/hooks/use-enterprise'
import * as systemConfigModule from '@/hooks/use-system-config'
import * as playgroundChatModule from './components/playground-chat'
import * as playgroundFirstRunModule from './components/playground-first-run'
import * as playgroundInputModule from './components/playground-input'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from './constants'
import * as playgroundHooksModule from './hooks'
import { applyPlaygroundHandoffModel } from './lib/playground-handoff'
import type { Message, PlaygroundConfig } from './types'

type CapturedInputProps = {
  initialText?: string
  modelValue: string
  onSubmit: (text: string) => void
}

const navigateMock = mock(() => undefined)
const sendChatMock = mock(
  (_submission: { messages: Message[]; model: string }) => undefined
)
const updateConfigMock = mock(() => undefined)
const updateMessagesMock = mock(() => undefined)
const setModelsMock = mock(() => undefined)
const setGroupsMock = mock(() => undefined)
let capturedInputProps: CapturedInputProps | undefined
let receivedInitialModel: string | undefined

spyOn(reactQueryModule, 'useQuery').mockImplementation((({
  queryKey,
}: {
  queryKey: string[]
}) =>
  queryKey[0] === 'playground-models'
    ? { data: undefined, isLoading: true }
    : { data: undefined }) as never)

spyOn(reactRouterModule, 'useNavigate').mockImplementation(
  (() => navigateMock) as never
)

spyOn(authStoreModule, 'useAuthStore').mockImplementation(((
  selector: (state: unknown) => unknown
) => selector({ auth: { user: { id: 42 } } })) as never)

spyOn(onboardingStoreModule, 'useOnboardingStore').mockImplementation(((
  selector: (state: unknown) => unknown
) => selector({ openOnboarding: () => undefined })) as never)

spyOn(enterpriseModule, 'useCanUseGroups').mockImplementation(() => false)

spyOn(systemConfigModule, 'useSystemConfig').mockImplementation((() => ({
  enableStripeCardBind: false,
  playgroundDefaultModel: undefined,
})) as never)

spyOn(playgroundChatModule, 'PlaygroundChat').mockImplementation(
  (() => null) as never
)

spyOn(playgroundFirstRunModule, 'FirstRunWelcome').mockImplementation(
  (() => null) as never
)

spyOn(playgroundFirstRunModule, 'GetKeyCard').mockImplementation(
  (() => null) as never
)

spyOn(playgroundInputModule, 'PlaygroundInput').mockImplementation(((
  props: CapturedInputProps
) => {
  capturedInputProps = props
  return React.createElement('div', null, props.initialText)
}) as never)

spyOn(playgroundHooksModule, 'usePlaygroundState').mockImplementation(((
  initialModel?: string
) => {
  receivedInitialModel = initialModel
  const config = applyPlaygroundHandoffModel(DEFAULT_CONFIG, initialModel)
  return {
    config,
    parameterEnabled: DEFAULT_PARAMETER_ENABLED,
    messages: [],
    models: [],
    groups: [],
    updateMessages: updateMessagesMock,
    setModels: setModelsMock,
    setGroups: setGroupsMock,
    updateConfig: updateConfigMock,
  }
}) as never)

spyOn(playgroundHooksModule, 'useChatHandler').mockImplementation((({
  config,
}: {
  config: PlaygroundConfig
}) => ({
  sendChat: (messages: Message[], override?: { model?: string }) =>
    sendChatMock({
      messages,
      model: override?.model ?? config.model,
    }),
  stopGeneration: () => undefined,
  isGenerating: false,
})) as never)

spyOn(playgroundHooksModule, 'useVideoGeneration').mockImplementation((() => ({
  generateVideo: () => undefined,
  stopVideoGeneration: () => undefined,
  releaseVideoObjectUrl: () => undefined,
  isVideoGenerating: false,
})) as never)

const localStorage = {
  getItem: () => null,
  removeItem: () => undefined,
}
const originalWindow = globalThis.window
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
})

const { Playground } = await import('./index')

function renderHandoff() {
  renderToStaticMarkup(
    <Playground initialModel='gpt-image-2' initialPrompt='Draw a violet fox' />
  )
  if (!capturedInputProps) throw new Error('PlaygroundInput was not rendered')
  return capturedInputProps
}

beforeEach(() => {
  capturedInputProps = undefined
  receivedInitialModel = undefined
  navigateMock.mockClear()
  sendChatMock.mockClear()
  updateConfigMock.mockClear()
  updateMessagesMock.mockClear()
  setModelsMock.mockClear()
  setGroupsMock.mockClear()
})

describe('Playground model landing handoff', () => {
  test('uses the requested model before the async model list resolves', () => {
    const input = renderHandoff()

    expect(receivedInitialModel).toBe('gpt-image-2')
    expect(input.modelValue).toBe('gpt-image-2')
    expect(input.initialText).toBe('Draw a violet fox')
    expect(sendChatMock).not.toHaveBeenCalled()

    input.onSubmit('Draw a violet fox')

    expect(sendChatMock).toHaveBeenCalledTimes(1)
    expect(sendChatMock.mock.calls[0]?.[0].model).toBe('gpt-image-2')
  })

  test('removes replayable handoff search state after explicit submit', () => {
    const input = renderHandoff()

    input.onSubmit('Draw a violet fox')

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/playground',
      search: {},
      replace: true,
    })
  })
})

afterAll(() => {
  mock.restore()
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, 'window')
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
})
