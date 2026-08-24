/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import * as React from 'react'
import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as playgroundApi from '../api'
import { MESSAGE_STATUS } from '../constants'
import type { Message } from '../types'

const sendMediaGenerationMock = spyOn(playgroundApi, 'sendMediaGeneration')
const fetchPlaygroundVideoTaskMock = spyOn(
  playgroundApi,
  'fetchPlaygroundVideoTask'
)
const { findResumableVideoMessage, useMediaGeneration, waitForVideoPoll } =
  await import('./use-media-generation')

const originalWindow = globalThis.window

beforeEach(() => {
  sendMediaGenerationMock.mockReset()
  fetchPlaygroundVideoTaskMock.mockReset()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      clearTimeout: () => undefined,
      setTimeout: (callback: () => void) => {
        queueMicrotask(callback)
        return 1
      },
    },
  })
})

afterAll(() => {
  sendMediaGenerationMock.mockRestore()
  fetchPlaygroundVideoTaskMock.mockRestore()
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

interface FakeSignal {
  aborted: boolean
  listeners: Set<(event: Event) => void>
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions
  ) => void
  removeEventListener: (type: string, listener: (event: Event) => void) => void
}

function createFakeSignal(): FakeSignal {
  const signal: FakeSignal = {
    aborted: false,
    listeners: new Set(),
    addEventListener(type, listener) {
      if (type === 'abort') signal.listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'abort') signal.listeners.delete(listener)
    },
  }
  return signal
}

function createMediaMessages(): Message[] {
  return [
    {
      key: 'previous-assistant',
      from: 'assistant',
      status: MESSAGE_STATUS.COMPLETE,
      versions: [{ id: 'previous-version', content: 'Previous result' }],
    },
    {
      key: 'target-assistant',
      from: 'assistant',
      status: MESSAGE_STATUS.LOADING,
      versions: [{ id: 'target-version', content: '' }],
    },
  ]
}

function renderMediaGenerationHook(initialMessages: Message[]) {
  let messages = initialMessages
  const updates: Message[][] = []
  let hook: ReturnType<typeof useMediaGeneration> | undefined

  function Harness() {
    hook = useMediaGeneration({
      messages,
      onMessageUpdate: (updater) => {
        messages = updater(messages)
        updates.push(messages)
      },
    })
    return null
  }

  renderToStaticMarkup(React.createElement(Harness))
  if (!hook) throw new Error('Media generation hook was not rendered')

  return {
    hook,
    messages: () => messages,
    updates,
  }
}

const seedanceSettings = {
  resolution: '720p',
  aspectRatio: '16:9',
  duration: 5,
  generateAudio: false,
}

describe('waitForVideoPoll', () => {
  test('removes its abort listener after the poll timer resolves', async () => {
    const signal = createFakeSignal()
    let resolveTimer: (() => void) | undefined

    const wait = waitForVideoPoll(
      signal as unknown as AbortSignal,
      (callback) => {
        resolveTimer = callback
        return 1
      },
      () => undefined
    )

    expect(signal.listeners.size).toBe(1)
    resolveTimer?.()
    await wait
    expect(signal.listeners.size).toBe(0)
  })

  test('clears its poll timer and removes its listener when aborted', async () => {
    const signal = createFakeSignal()
    let clearCount = 0
    const wait = waitForVideoPoll(
      signal as unknown as AbortSignal,
      () => 1,
      () => {
        clearCount += 1
      }
    )

    const [listener] = [...signal.listeners]
    signal.aborted = true
    listener?.(new Event('abort'))
    await wait

    expect(clearCount).toBe(1)
    expect(signal.listeners.size).toBe(0)
  })
})

describe('useMediaGeneration video task lifecycle', () => {
  test('selects the newest in-flight persisted video task for reload recovery', () => {
    const messages: Message[] = [
      {
        key: 'older-task',
        from: 'assistant',
        status: MESSAGE_STATUS.STREAMING,
        versions: [{ id: 'older-version', content: 'Generating video...' }],
        videoTaskId: 'video-task-older',
      },
      {
        key: 'completed-task',
        from: 'assistant',
        status: MESSAGE_STATUS.COMPLETE,
        versions: [{ id: 'completed-version', content: 'Generated video' }],
        videoTaskId: 'video-task-completed',
      },
      {
        key: 'newer-task',
        from: 'assistant',
        status: MESSAGE_STATUS.LOADING,
        versions: [{ id: 'newer-version', content: '' }],
        videoTaskId: 'video-task-newer',
      },
    ]

    expect(findResumableVideoMessage(messages)?.key).toBe('newer-task')
  })

  test('persists the task id on the exact assistant message and clears it on completion', async () => {
    sendMediaGenerationMock.mockResolvedValue({
      id: 'video-task-123',
      status: 'queued',
      progress: 10,
    })
    fetchPlaygroundVideoTaskMock.mockResolvedValue({
      id: 'video-task-123',
      status: 'completed',
      url: 'https://cdn.example.com/video.mp4',
    })
    const harness = renderMediaGenerationHook(createMediaMessages())

    await harness.hook.generateMedia(
      'A ship at sea',
      'seedance-2.0',
      'default',
      seedanceSettings,
      'target-assistant'
    )

    const submitted = harness.updates[0]
    expect(submitted?.[0]?.versions[0]?.content).toBe('Previous result')
    expect(submitted?.[1]).toMatchObject({
      key: 'target-assistant',
      status: MESSAGE_STATUS.STREAMING,
      videoTaskId: 'video-task-123',
    })

    const completed = harness.messages()[1]
    expect(completed).toMatchObject({
      key: 'target-assistant',
      status: MESSAGE_STATUS.COMPLETE,
      versions: [
        {
          generatedMedia: [
            { type: 'video', url: 'https://cdn.example.com/video.mp4' },
          ],
        },
      ],
    })
    expect('videoTaskId' in completed).toBe(false)
  })

  test('clears the persisted task id when the video task fails', async () => {
    sendMediaGenerationMock.mockResolvedValue({
      id: 'video-task-failed',
      status: 'queued',
    })
    fetchPlaygroundVideoTaskMock.mockResolvedValue({
      id: 'video-task-failed',
      status: 'failed',
      error: 'Upstream rejected the task',
    })
    const harness = renderMediaGenerationHook(createMediaMessages())

    await harness.hook.generateMedia(
      'A ship at sea',
      'seedance-2.0',
      'default',
      seedanceSettings,
      'target-assistant'
    )

    const failed = harness.messages()[1]
    expect(failed.status).toBe(MESSAGE_STATUS.ERROR)
    expect(failed.versions[0]?.content).toContain('Upstream rejected the task')
    expect('videoTaskId' in failed).toBe(false)
  })

  test('clears the persisted task id when the active generation is stopped', async () => {
    let resolveSubmission: ((value: unknown) => void) | undefined
    sendMediaGenerationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve
        })
    )
    const messages = createMediaMessages()
    messages[1] = {
      ...messages[1],
      status: MESSAGE_STATUS.STREAMING,
      videoTaskId: 'video-task-stopped',
    }
    const harness = renderMediaGenerationHook(messages)

    const generation = harness.hook.generateMedia(
      'A ship at sea',
      'seedance-2.0',
      'default',
      seedanceSettings,
      'target-assistant'
    )
    harness.hook.stopMediaGeneration()
    resolveSubmission?.({ id: 'video-task-stopped', status: 'queued' })
    await generation

    const stopped = harness.messages()[1]
    expect(stopped.status).toBe(MESSAGE_STATUS.COMPLETE)
    expect('videoTaskId' in stopped).toBe(false)
  })
})
