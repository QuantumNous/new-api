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
import { afterAll, afterEach, beforeEach, describe, test } from 'bun:test'
import assert from 'node:assert/strict'

import { domWindow, resetSharedDomWindow } from '@/test-utils/happy-dom-env'

// 静态 import 无法满足本测试：模块必须在 happy-dom 全局安装之后求值（bunfig
// preload + 下方运行时 import 的组合），与 keys/components 其余测试保持一致。
import type { Root } from 'react-dom/client'
import type { ApiKey } from '../../types'

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { api } = await import('@/lib/api')
const { ApiKeysProvider } = await import('../api-keys-provider')
const { ApiKeyCell } = await import('../api-keys-cells')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Copy API key': 'Copy API key',
        'Loading...': 'Loading...',
        'Copied!': 'Copied!',
      },
    },
  },
})

// happy-dom 的 clipboard 没有 writeText，复制需要边界替身；替身记录写入内容，
// 断言因此落在用户可见契约上（点击复制的是完整密钥，而不是页面上的掩码）。
const clipboardWrites: string[] = []
const originalClipboard = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  'clipboard'
)
Object.defineProperty(globalThis.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: (text: string) => {
      clipboardWrites.push(text)
      return Promise.resolve()
    },
  },
})

type ApiMethod = (
  url: string,
  data?: unknown
) => Promise<{ data: unknown }>
type MockableApi = {
  post: ApiMethod
}
const apiClient = api as unknown as MockableApi
const originalPost = apiClient.post

type KeyResponse = { success: boolean; message?: string; data?: { key: string } }
type PendingKeyRequest = {
  settle: (response: KeyResponse) => void
}

let pendingKeyRequest: PendingKeyRequest | null = null

// 每个测试重新挂桩（afterEach 会恢复真实 axios），保证用例互不依赖执行顺序。
function stubKeyPost() {
  apiClient.post = async (url: string) => {
    if (url !== '/api/token/7/key') {
      throw new Error(`Unexpected POST ${url}`)
    }
    return await new Promise<{ data: KeyResponse }>((resolve) => {
      pendingKeyRequest = {
        settle: (response) => resolve({ data: response }),
      }
    })
  }
}

beforeEach(() => {
  stubKeyPost()
})

const MASKED_KEY = 'abcd**********wxyz'
const FULL_KEY = 'sk-live_full_key_123'

const apiKey: ApiKey = {
  id: 7,
  name: 'ci-key',
  key: MASKED_KEY,
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: 'default',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}

type MountedCell = {
  container: HTMLElement
  root: Root
}

async function mountCell(): Promise<MountedCell> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <ApiKeysProvider>
            <ApiKeyCell apiKey={apiKey} />
          </ApiKeysProvider>
        </TooltipProvider>
      </I18nextProvider>
    )
  )

  return { container, root }
}

function getCopyButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button')
  assert.ok(button, 'the key cell renders one copy control')
  return button
}

function settleKeyRequest(response: KeyResponse) {
  assert.ok(pendingKeyRequest, 'the full key request is in flight')
  pendingKeyRequest.settle(response)
  pendingKeyRequest = null
}

afterEach(async () => {
  apiClient.post = originalPost
  clipboardWrites.length = 0
  pendingKeyRequest = null
  domWindow.localStorage.clear()
})

afterAll(async () => {
  if (originalClipboard) {
    Object.defineProperty(
      globalThis.navigator,
      'clipboard',
      originalClipboard
    )
  }
  await resetSharedDomWindow()
})

describe('API key cell copies the full key without revealing it', () => {
  test('shows the masked key with a trailing copy icon and never renders the full key', async () => {
    const { container, root } = await mountCell()
    const button = getCopyButton(container)

    assert.equal(button.textContent?.includes(`sk-${MASKED_KEY}`), true)
    assert.equal(container.textContent?.includes(FULL_KEY), false)
    assert.equal(container.querySelector('input'), null)
    assert.ok(button.querySelector('svg'), 'renders a copy icon')

    await act(async () => root.unmount())
    container.remove()
  })

  test('copies the full key on click and keeps it out of the table DOM', async () => {
    const { container, root } = await mountCell()
    const button = getCopyButton(container)

    await act(async () => {
      button.click()
    })
    await act(async () => {
      settleKeyRequest({ success: true, data: { key: 'live_full_key_123' } })
    })

    assert.deepEqual(clipboardWrites, [FULL_KEY])
    assert.equal(container.textContent?.includes(FULL_KEY), false)
    assert.equal(container.querySelector('input'), null)
    assert.ok(
      container.querySelector('svg[class*="text-green-600"]'),
      'shows the copied check icon'
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('disables the control and shows a loading icon while the full key is fetched', async () => {
    const { container, root } = await mountCell()
    const button = getCopyButton(container)

    await act(async () => {
      button.click()
    })

    assert.equal(button.disabled, true)
    assert.ok(
      container.querySelector('svg[class*="animate-spin"]'),
      'shows the loading icon while resolving'
    )
    assert.deepEqual(clipboardWrites, [])

    await act(async () => {
      settleKeyRequest({ success: true, data: { key: 'live_full_key_123' } })
    })

    assert.equal(button.disabled, false)
    assert.deepEqual(clipboardWrites, [FULL_KEY])
    assert.ok(
      container.querySelector('svg[class*="text-green-600"]'),
      'shows the copied check icon after resolution'
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('copies nothing when the full key cannot be resolved', async () => {
    const { container, root } = await mountCell()
    const button = getCopyButton(container)

    await act(async () => {
      button.click()
    })
    await act(async () => {
      settleKeyRequest({ success: false, message: 'nope' })
    })

    assert.deepEqual(clipboardWrites, [])
    assert.equal(
      container.querySelector('svg[class*="text-green-600"]'),
      null,
      'never marks the key as copied'
    )
    assert.equal(container.textContent?.includes(FULL_KEY), false)

    await act(async () => root.unmount())
    container.remove()
  })
})
