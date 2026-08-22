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
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Turnstile, type TurnstileStatus } from '@/components/turnstile'

type TurnstileOptions = Record<string, unknown>

function createTurnstileApi() {
  const renderOptions: TurnstileOptions[] = []
  const api = {
    render: vi.fn((_element: HTMLElement, options: TurnstileOptions) => {
      renderOptions.push(options)
      return renderOptions.length
    }),
    remove: vi.fn(),
  }
  return { api, renderOptions }
}

function dispatchScriptEvent(type: 'load' | 'error') {
  const script = document.querySelector('#cf-turnstile')
  expect(script).not.toBeNull()
  script?.dispatchEvent(new Event(type))
}

describe('Turnstile', () => {
  beforeEach(() => {
    delete window.turnstile
    document.head.innerHTML = ''
  })

  afterEach(() => {
    delete window.turnstile
    document.head.innerHTML = ''
  })

  test('renders the replacement widget when navigation occurs during script loading', async () => {
    const { api } = createTurnstileApi()
    const firstStatus: TurnstileStatus[] = []
    const secondStatus: TurnstileStatus[] = []

    const firstWidget = render(
      <Turnstile
        siteKey='site-key'
        onVerify={vi.fn()}
        onStatusChange={(status) => firstStatus.push(status)}
      />
    )
    expect(document.querySelectorAll('#cf-turnstile')).toHaveLength(1)

    firstWidget.unmount()
    render(
      <Turnstile
        siteKey='site-key'
        onVerify={vi.fn()}
        onStatusChange={(status) => secondStatus.push(status)}
      />
    )

    expect(document.querySelectorAll('#cf-turnstile')).toHaveLength(1)
    window.turnstile = api
    dispatchScriptEvent('load')

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    expect(firstStatus).toEqual(['loading'])
    expect(secondStatus[0]).toBe('loading')
  })

  test('reports a load error and retries after the failed script is removed', async () => {
    const firstStatus: Array<[TurnstileStatus, string | undefined]> = []
    const { rerender } = render(
      <Turnstile
        siteKey='site-key'
        onVerify={vi.fn()}
        onStatusChange={(status, errorCode) =>
          firstStatus.push([status, errorCode])
        }
      />
    )

    const firstScript = document.querySelector('#cf-turnstile')
    dispatchScriptEvent('error')
    await waitFor(() =>
      expect(firstStatus).toContainEqual(['error', 'script-load-failed'])
    )
    expect(document.querySelector('#cf-turnstile')).toBeNull()

    rerender(
      <Turnstile
        key='retry'
        siteKey='site-key'
        onVerify={vi.fn()}
        onStatusChange={vi.fn()}
      />
    )

    const secondScript = document.querySelector('#cf-turnstile')
    expect(secondScript).not.toBeNull()
    expect(secondScript).not.toBe(firstScript)
    const { api } = createTurnstileApi()
    window.turnstile = api
    secondScript?.dispatchEvent(new Event('load'))
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
  })

  test('reports provider errors and expiration while preserving legacy expiry callback behavior', async () => {
    const { api, renderOptions } = createTurnstileApi()
    window.turnstile = api
    const statuses: Array<[TurnstileStatus, string | undefined]> = []
    const onExpire = vi.fn()
    const onError = vi.fn()

    render(
      <Turnstile
        siteKey='site-key'
        onVerify={vi.fn()}
        onExpire={onExpire}
        onError={onError}
        onStatusChange={(status, errorCode) =>
          statuses.push([status, errorCode])
        }
      />
    )

    await waitFor(() => expect(renderOptions).toHaveLength(1))
    const options = renderOptions[0]
    const errorCallback = options['error-callback'] as () => void
    const expiredCallback = options['expired-callback'] as () => void

    errorCallback()
    expiredCallback()

    expect(statuses).toContainEqual(['error', 'challenge-failed'])
    expect(statuses).toContainEqual(['expired', undefined])
    expect(onError).toHaveBeenCalledWith('challenge-failed')
    expect(onExpire).toHaveBeenCalledTimes(2)
  })
})
