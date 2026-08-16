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
import assert from 'node:assert/strict'
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
Object.defineProperty(domWindow, 'PointerEvent', {
  configurable: true,
  value: domWindow.MouseEvent,
})
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'MouseEvent',
  'FocusEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { api } = await import('@/lib/http-client')
const { submitChannelContribution } = await import('../../api')
const { executeTurnstileSubmission } = await import('../../lib')
const { ContributionSubmissionControls } =
  await import('../submission-controls')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiPost = (
  url: string,
  data?: unknown,
  config?: unknown
) => Promise<{ data: unknown }>
const apiClient = api as unknown as { post: ApiPost }
const originalPost = apiClient.post
let renderedRoot: ReturnType<typeof createRoot> | null = null
let renderedHost: HTMLDivElement | null = null

function findSubmitButton(): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.includes('Submit for review'))
  assert.ok(button)
  return button
}

async function renderControls(props: {
  token: string
  onSubmit: () => void
  onExpire?: () => void
  onAgreementCheckedChange?: (checked: boolean) => void
  onOpenAgreement?: () => void
}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  renderedHost = host
  renderedRoot = root
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <ContributionSubmissionControls
          ready
          agreementChecked
          onAgreementCheckedChange={
            props.onAgreementCheckedChange ?? (() => undefined)
          }
          onOpenAgreement={props.onOpenAgreement ?? (() => undefined)}
          isTurnstileEnabled
          turnstileSiteKey='test-site-key'
          turnstileToken={props.token}
          turnstileWidgetKey={0}
          onTurnstileVerify={() => undefined}
          onTurnstileExpire={props.onExpire ?? (() => undefined)}
          onSubmit={props.onSubmit}
          submitting={false}
        />
      </I18nextProvider>
    )
    await Promise.resolve()
  })
}

afterEach(async () => {
  apiClient.post = originalPost
  if (renderedRoot) {
    await act(async () => renderedRoot?.unmount())
  }
  renderedHost?.remove()
  renderedRoot = null
  renderedHost = null
  document.body.replaceChildren()
  delete (window as unknown as Window & { turnstile?: unknown }).turnstile
})

after(() => {
  domWindow.close()
})

describe('channel contribution Turnstile submission', () => {
  test('disables submit and does not call the handler when verification is empty', async () => {
    let calls = 0
    await renderControls({ token: '', onSubmit: () => calls++ })
    const button = findSubmitButton()

    assert.equal(button.disabled, true)
    button.click()
    assert.equal(calls, 0)
  })

  test('sends a verified token as the submit query parameter', async () => {
    let captured: { url?: string; config?: unknown } = {}
    apiClient.post = async (url, _data, config) => {
      captured = { url, config }
      return { data: { success: true, data: { id: 7 } } }
    }

    await submitChannelContribution(
      7,
      {
        test_run_id: 91,
        agreement_version: '2026-08-16',
        agreement_accepted: true,
      },
      'verified-token'
    )

    assert.equal(captured.url, '/api/channel-contributions/7/submit')
    assert.deepEqual(captured.config, {
      params: { turnstile: 'verified-token' },
    })
  })

  test('opens the agreement without changing the checkbox state', async () => {
    let agreementChanges = 0
    let agreementOpens = 0
    await renderControls({
      token: 'verified-token',
      onSubmit: () => undefined,
      onAgreementCheckedChange: () => agreementChanges++,
      onOpenAgreement: () => agreementOpens++,
    })
    const agreementButton = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) =>
      button.textContent?.includes('Channel Contribution Agreement')
    )
    assert.ok(agreementButton)

    agreementButton.click()

    assert.equal(agreementOpens, 1)
    assert.equal(agreementChanges, 0)
  })

  test('resets the token and widget after success and business failure', async () => {
    for (const success of [true, false]) {
      let token = 'verified-token'
      let widgetKey = 4
      const execution = await executeTurnstileSubmission({
        enabled: true,
        token,
        submit: async (submittedToken) => ({ success, submittedToken }),
        reset: () => {
          token = ''
          widgetKey++
        },
      })

      assert.equal(execution.called, true)
      assert.equal(execution.result?.submittedToken, 'verified-token')
      assert.equal(token, '')
      assert.equal(widgetKey, 5)
    }
  })

  test('clears verification when the Turnstile widget expires', async () => {
    let renderOptions: Record<string, unknown> | null = null
    window.turnstile = {
      render: (_element, options) => {
        renderOptions = options
      },
    }

    function Harness() {
      const [token, setToken] = useState('verified-token')
      const [widgetKey, setWidgetKey] = useState(0)
      return (
        <ContributionSubmissionControls
          ready
          agreementChecked
          onAgreementCheckedChange={() => undefined}
          onOpenAgreement={() => undefined}
          isTurnstileEnabled
          turnstileSiteKey='test-site-key'
          turnstileToken={token}
          turnstileWidgetKey={widgetKey}
          onTurnstileVerify={setToken}
          onTurnstileExpire={() => {
            setToken('')
            setWidgetKey((current) => current + 1)
          }}
          onSubmit={() => undefined}
          submitting={false}
        />
      )
    }

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    renderedHost = host
    renderedRoot = root
    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <Harness />
        </I18nextProvider>
      )
      await Promise.resolve()
    })
    assert.equal(findSubmitButton().disabled, false)
    assert.ok(renderOptions)
    const expire = renderOptions['expired-callback']
    assert.equal(typeof expire, 'function')

    await act(async () => {
      ;(expire as () => void)()
      await Promise.resolve()
    })
    assert.equal(findSubmitButton().disabled, true)
  })
})
