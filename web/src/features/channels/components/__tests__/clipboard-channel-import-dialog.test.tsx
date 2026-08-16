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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ClipboardChannelImportDialog } =
  await import('../dialogs/clipboard-channel-import-dialog')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalPost = apiClient.post

type ImportCall = { url: string; payload: Record<string, unknown> }
type ImportHandler = (payload: Record<string, unknown>) => unknown

// 回显请求中的 item_id：真实后端会把客户端生成并提交的 item_id 原样带回，
// 重试逻辑依赖它把结果匹配回预览条目。
function installImportApiFixture(handlers: ImportHandler[]): ImportCall[] {
  const calls: ImportCall[] = []
  apiClient.post = async (url, data) => {
    calls.push({ url, payload: data as Record<string, unknown> })
    if (url === '/api/channel/import') {
      const handler = handlers.shift()
      if (!handler) {
        throw new Error('Unexpected extra import call')
      }
      return { data: handler(data as Record<string, unknown>) }
    }
    if (url === '/api/channel/import/rollback') {
      return { data: { success: true, data: 1 } }
    }
    throw new Error(`Unexpected POST ${url}`)
  }
  return calls
}

function importedItems(
  payload: Record<string, unknown>
): Array<Record<string, unknown>> {
  return payload.items as Array<Record<string, unknown>>
}

function renderDialog(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ClipboardChannelImportDialog
          open
          onOpenChange={() => undefined}
          initialText=''
          onClearSensitiveText={() => undefined}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function findButton(text: string): HTMLButtonElement {
  const button = screen
    .queryAllByRole<HTMLButtonElement>('button')
    .find((candidate) => candidate.textContent?.includes(text))
  if (!button) {
    throw new Error(`Expected button containing "${text}"`)
  }
  return button
}

function pasteClipboardText(text: string): void {
  fireEvent.input(screen.getByLabelText('Clipboard Text'), {
    target: { value: text },
  })
}

afterEach(() => {
  apiClient.post = originalPost
  localStorage.clear()
})

describe('ClipboardChannelImportDialog', () => {
  test('parses pasted text into a masked preview and submits one item per URL group', async () => {
    const calls = installImportApiFixture([
      (payload) => ({
        success: true,
        data: {
          results: [
            {
              item_id: importedItems(payload)[0]?.item_id,
              status: 'created',
              channel_id: 7,
              name: 'Temporary · api.example.com',
              base_url: 'https://api.example.com',
              key_count: 2,
              models: ['gpt-4.1'],
              enabled: true,
            },
          ],
          summary: {
            created: 1,
            existing: 0,
            duplicate: 0,
            needs_configuration: 0,
            failed: 0,
          },
        },
      }),
    ])
    renderDialog()

    pasteClipboardText(
      'Base URL: https://api.example.com/v1\nAPI Key: sk-alpha-example-key\nsk-beta-example-key'
    )

    await waitFor(() =>
      expect(document.body.textContent).toContain('1 URL groups detected')
    )
    fireEvent.click(findButton('Use Parsed Results'))
    await waitFor(() =>
      expect(screen.queryByLabelText('Clipboard Text')).toBe(null)
    )
    expect(document.body.textContent).toContain('2 keys')
    expect(document.body.textContent).toContain('sk-alph')
    expect(document.body.textContent).not.toContain('sk-alpha-example-key')

    fireEvent.click(findButton('Confirm Import'))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.url).toBe('/api/channel/import')
    const payload = calls[0]?.payload
    expect(payload?.retry_unverified).toBe(false)
    expect(payload?.items).toEqual([
      {
        item_id: expect.any(String),
        name: undefined,
        base_url: 'https://api.example.com',
        keys: ['sk-alpha-example-key', 'sk-beta-example-key'],
      },
    ])
    await waitFor(() =>
      expect(document.body.textContent).toContain('Created and verified')
    )
  })

  test('keeps Confirm Import disabled for unmatched content until explicitly ignored', async () => {
    installImportApiFixture([])
    renderDialog()

    pasteClipboardText(
      'Base URL: https://api.example.com\nAPI Key: sk-alpha-example-key\n\nhttps://orphan.example.com'
    )

    await waitFor(() =>
      expect(document.body.textContent).toContain(
        'Some keys or URLs could not be matched safely.'
      )
    )
    expect(findButton('Confirm Import').disabled).toBe(true)

    const ignoreSwitch = document.querySelector(
      '#ignore-unmatched-import-items'
    )
    if (!ignoreSwitch) {
      throw new Error('Expected the ignore-unmatched switch')
    }
    fireEvent.click(ignoreSwitch)
    await waitFor(() =>
      expect(findButton('Confirm Import').disabled).toBe(false)
    )
  })

  test('retry resubmits only problem items and merges the updated results', async () => {
    const calls = installImportApiFixture([
      (payload) => {
        const [ok, problem] = importedItems(payload)
        return {
          success: true,
          data: {
            results: [
              {
                item_id: ok?.item_id,
                status: 'created',
                channel_id: 1,
                name: 'Temporary · ok.example.com',
                base_url: 'https://ok.example.com',
                key_count: 1,
                enabled: true,
              },
              {
                item_id: problem?.item_id,
                status: 'needs_configuration',
                channel_id: 2,
                name: 'Temporary · bad.example.com',
                base_url: 'https://bad.example.com',
                key_count: 1,
                enabled: false,
                message: 'Model discovery failed',
              },
            ],
            summary: {
              created: 1,
              existing: 0,
              duplicate: 0,
              needs_configuration: 1,
              failed: 0,
            },
          },
        }
      },
      (payload) => ({
        success: true,
        data: {
          results: [
            {
              item_id: importedItems(payload)[0]?.item_id,
              status: 'existing',
              channel_id: 2,
              name: 'Temporary · bad.example.com',
              base_url: 'https://bad.example.com',
              key_count: 1,
              enabled: true,
            },
          ],
          summary: {
            created: 0,
            existing: 1,
            duplicate: 0,
            needs_configuration: 0,
            failed: 0,
          },
        },
      }),
    ])
    renderDialog()

    pasteClipboardText(
      'Base URL: https://ok.example.com\nAPI Key: sk-ok-example-key\n\nBase URL: https://bad.example.com\nAPI Key: sk-bad-example-key'
    )
    await waitFor(() =>
      expect(document.body.textContent).toContain('2 URL groups detected')
    )

    fireEvent.click(findButton('Confirm Import'))
    await waitFor(() =>
      expect(document.body.textContent).toContain('Needs configuration')
    )

    await waitFor(() => {
      expect(
        screen
          .queryAllByRole('button')
          .find((b) => b.textContent?.includes('Retry Problem Items'))
      ).toBeTruthy()
    })
    fireEvent.click(findButton('Retry Problem Items'))
    await waitFor(() => expect(calls).toHaveLength(2))

    const retryPayload = calls[1]?.payload
    expect(retryPayload?.retry_unverified).toBe(true)
    const retryItems = (retryPayload?.items ?? []) as Array<{
      base_url: string
    }>
    expect(retryItems).toHaveLength(1)
    expect(retryItems[0]?.base_url).toBe('https://bad.example.com')

    // 重试全部成功后不再出现重试按钮
    await waitFor(() => {
      expect(
        screen
          .queryAllByRole('button')
          .find((b) => b.textContent?.includes('Retry Problem Items'))
      ).toBeFalsy()
    })
    await waitFor(() => {
      const text = document.body.textContent ?? ''
      // 合并后的结果视图仍保留成功项，同时问题项更新为已启用
      expect(text).toContain('Temporary · ok.example.com')
      expect(text).toContain('Already imported')
      expect(text).not.toContain('Needs configuration')
    })
  })

  test('rollback clears the results view after the batch is removed', async () => {
    const calls = installImportApiFixture([
      (payload) => ({
        success: true,
        data: {
          results: [
            {
              item_id: importedItems(payload)[0]?.item_id,
              status: 'created',
              channel_id: 5,
              name: 'Temporary · api.example.com',
              base_url: 'https://api.example.com',
              key_count: 1,
              enabled: true,
            },
          ],
          summary: {
            created: 1,
            existing: 0,
            duplicate: 0,
            needs_configuration: 0,
            failed: 0,
          },
        },
      }),
    ])
    renderDialog()

    pasteClipboardText(
      'Base URL: https://api.example.com\nAPI Key: sk-alpha-example-key'
    )
    await waitFor(() =>
      expect(document.body.textContent).toContain('1 URL groups detected')
    )
    fireEvent.click(findButton('Confirm Import'))
    await waitFor(() =>
      expect(document.body.textContent).toContain('Created and verified')
    )

    fireEvent.click(findButton('Rollback This Import'))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.url).toBe('/api/channel/import/rollback')
    expect(typeof calls[1]?.payload?.batch_id).toBe('string')

    await waitFor(() => {
      const text = document.body.textContent ?? ''
      expect(text).not.toContain('Import Results')
      expect(text).toContain('1 URL groups detected')
    })
  })
})
