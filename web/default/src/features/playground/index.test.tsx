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
  modelLocked?: boolean
  modelValue: string
  onStop?: () => void
  submitDisabled?: boolean
  onSubmit: (text: string) => void
}

type CapturedChatProps = {
  onRegenerateMessage: (message: Message) => void
}

type CapturedWelcomeProps = {
  onPickExample: (prompt: string, model?: string) => void
}

const navigateMock = mock(() => undefined)
const sendChatMock = mock(
  (_submission: { messages: Message[]; model: string }) => undefined
)
const generateMediaMock = mock(
  (
    _prompt: string,
    _model: string,
    _group: string,
    _settings: Record<string, unknown>
  ) => Promise.resolve()
)
const stopChatMock = mock(() => undefined)
const stopMediaMock = mock(() => undefined)
const updateConfigMock = mock(() => undefined)
const updateMessagesMock = mock(() => undefined)
const setModelsMock = mock(() => undefined)
const setGroupsMock = mock(() => undefined)
let capturedInputProps: CapturedInputProps | undefined
let capturedChatProps: CapturedChatProps | undefined
let capturedWelcomeProps: CapturedWelcomeProps | undefined
let receivedInitialModel: string | undefined
let modelsQueryData: string[] | undefined
let isModelsQueryLoading = true
let isChatGenerating = false
let isMediaGenerating = false
let playgroundMessages: Message[] = []

spyOn(reactQueryModule, 'useQuery').mockImplementation((({
  queryKey,
}: {
  queryKey: string[]
}) =>
  queryKey[0] === 'playground-models'
    ? { data: modelsQueryData, isLoading: isModelsQueryLoading }
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

spyOn(playgroundChatModule, 'PlaygroundChat').mockImplementation(((
  props: CapturedChatProps
) => {
  capturedChatProps = props
  return null
}) as never)

spyOn(playgroundFirstRunModule, 'FirstRunWelcome').mockImplementation(((
  props: CapturedWelcomeProps
) => {
  capturedWelcomeProps = props
  return null
}) as never)

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
    messages: playgroundMessages,
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
  stopGeneration: stopChatMock,
  isGenerating: isChatGenerating,
})) as never)

spyOn(playgroundHooksModule, 'useMediaGeneration').mockImplementation((() => ({
  generateMedia: generateMediaMock,
  stopMediaGeneration: stopMediaMock,
  isGeneratingMedia: isMediaGenerating,
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

function renderHandoff(
  initialModel = 'gpt-image-2',
  initialPrompt = 'Draw a violet fox'
) {
  renderToStaticMarkup(
    <Playground initialModel={initialModel} initialPrompt={initialPrompt} />
  )
  if (!capturedInputProps) throw new Error('PlaygroundInput was not rendered')
  return capturedInputProps
}

beforeEach(() => {
  capturedInputProps = undefined
  capturedChatProps = undefined
  capturedWelcomeProps = undefined
  receivedInitialModel = undefined
  modelsQueryData = undefined
  isModelsQueryLoading = true
  isChatGenerating = false
  isMediaGenerating = false
  playgroundMessages = []
  navigateMock.mockClear()
  sendChatMock.mockClear()
  generateMediaMock.mockClear()
  stopChatMock.mockClear()
  stopMediaMock.mockClear()
  updateConfigMock.mockClear()
  updateMessagesMock.mockClear()
  setModelsMock.mockClear()
  setGroupsMock.mockClear()
})

describe('Playground model landing handoff', () => {
  test('shows the requested model but blocks submit until it is validated', () => {
    const input = renderHandoff()

    expect(receivedInitialModel).toBe('gpt-image-2')
    expect(input.modelValue).toBe('gpt-image-2')
    expect(input.modelLocked).toBe(true)
    expect(input.initialText).toBe('Draw a violet fox')
    expect(input.submitDisabled).toBe(true)
    expect(sendChatMock).not.toHaveBeenCalled()

    input.onSubmit('Draw a violet fox')

    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('submits an authorized image model after the model list resolves', () => {
    modelsQueryData = ['gpt-4o', 'gpt-image-2']
    isModelsQueryLoading = false
    const input = renderHandoff()

    expect(input.modelValue).toBe('gpt-image-2')
    expect(input.modelLocked).toBe(true)
    expect(input.submitDisabled).toBe(false)

    input.onSubmit('Draw a violet fox')

    expect(generateMediaMock).toHaveBeenCalledTimes(1)
    expect(generateMediaMock.mock.calls[0]?.[1]).toBe('gpt-image-2')
    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('blocks a URL model missing from the user model list', () => {
    modelsQueryData = ['gpt-4o']
    isModelsQueryLoading = false
    const input = renderHandoff('not-a-real-model', 'Draw a violet fox')

    expect(input.modelLocked).toBe(true)
    expect(input.submitDisabled).toBe(true)

    input.onSubmit('Draw a violet fox')

    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('blocks regenerate until the URL model is validated', () => {
    playgroundMessages = [
      {
        key: 'user-message',
        from: 'user',
        versions: [{ id: 'user-version', content: 'Draw a violet fox' }],
      },
      {
        key: 'assistant-message',
        from: 'assistant',
        versions: [{ id: 'assistant-version', content: 'Previous result' }],
      },
    ]
    renderHandoff()
    if (!capturedChatProps) throw new Error('PlaygroundChat was not rendered')

    capturedChatProps.onRegenerateMessage(playgroundMessages[1])

    expect(updateMessagesMock).not.toHaveBeenCalled()
    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('removes replayable handoff search state after explicit submit', () => {
    modelsQueryData = ['gpt-4o', 'gpt-image-2']
    isModelsQueryLoading = false
    const input = renderHandoff()

    input.onSubmit('Draw a violet fox')

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/playground',
      search: {},
      replace: true,
    })
  })

  test('keeps first-run example model overrides on the locked handoff model', () => {
    modelsQueryData = ['gpt-image-2', 'gemini-2.5-flash-image']
    isModelsQueryLoading = false
    renderHandoff('gpt-image-2', 'Draw a violet fox')
    if (!capturedWelcomeProps)
      throw new Error('FirstRunWelcome was not rendered')

    capturedWelcomeProps.onPickExample(
      'Generate an image',
      'gemini-2.5-flash-image'
    )

    expect(generateMediaMock).toHaveBeenCalledTimes(1)
    expect(generateMediaMock.mock.calls[0]?.[1]).toBe('gpt-image-2')
    expect(sendChatMock).not.toHaveBeenCalled()
    expect(updateConfigMock).not.toHaveBeenCalledWith(
      'model',
      'gemini-2.5-flash-image'
    )
  })

  test('allows a first-run handoff to an authorized filtered model', () => {
    modelsQueryData = ['gpt-image-2']
    isModelsQueryLoading = false

    renderToStaticMarkup(
      <Playground
        firstRun
        initialModel='gpt-image-2'
        initialPrompt='Draw a violet fox'
      />
    )
    if (!capturedInputProps) throw new Error('PlaygroundInput was not rendered')

    expect(capturedInputProps.modelLocked).toBe(true)
    expect(capturedInputProps.modelValue).toBe('gpt-image-2')
    expect(capturedInputProps.submitDisabled).toBe(false)
    expect(sendChatMock).not.toHaveBeenCalled()

    capturedInputProps.onSubmit('Draw a violet fox')

    expect(generateMediaMock).toHaveBeenCalledTimes(1)
    expect(generateMediaMock.mock.calls[0]?.[1]).toBe('gpt-image-2')
    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('leaves the model selector unlocked on an ordinary visit', () => {
    modelsQueryData = ['gpt-4o']
    isModelsQueryLoading = false

    renderToStaticMarkup(<Playground />)
    if (!capturedInputProps) throw new Error('PlaygroundInput was not rendered')

    expect(capturedInputProps.modelLocked).toBe(false)
    expect(sendChatMock).not.toHaveBeenCalled()
  })

  test('stops only the active chat generation', () => {
    modelsQueryData = ['gpt-4o']
    isModelsQueryLoading = false
    isChatGenerating = true

    renderToStaticMarkup(<Playground />)
    if (!capturedInputProps?.onStop)
      throw new Error('PlaygroundInput stop action was not rendered')

    capturedInputProps.onStop()

    expect(stopChatMock).toHaveBeenCalledTimes(1)
    expect(stopMediaMock).not.toHaveBeenCalled()
  })

  test('stops only the active media generation', () => {
    modelsQueryData = ['gpt-image-2']
    isModelsQueryLoading = false
    isMediaGenerating = true

    renderToStaticMarkup(<Playground />)
    if (!capturedInputProps?.onStop)
      throw new Error('PlaygroundInput stop action was not rendered')

    capturedInputProps.onStop()

    expect(stopMediaMock).toHaveBeenCalledTimes(1)
    expect(stopChatMock).not.toHaveBeenCalled()
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
