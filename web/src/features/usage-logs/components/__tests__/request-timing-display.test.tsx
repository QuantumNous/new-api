import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'
import type React from 'react'

import type { UsageLog } from '../../data/schema'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'PointerEvent',
  'MutationObserver',
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

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { RequestTimingBreakdown } = await import('../request-timing-breakdown')
const { TimingMetricsCell } = await import('../timing-metrics-cell')
const { DetailsDialog } = await import('../dialogs/details-dialog')
const { buildTimingPresentation } = await import('../../lib/request-timing')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Timing breakdown': 'Timing breakdown',
        'Gateway processing': 'Gateway processing',
        'Upstream first data': 'Upstream first data',
        'First data to client': 'First data to client',
        'Client streaming': 'Client streaming',
        Finalization: 'Finalization',
        'First token': 'First token',
        Duration: 'Duration',
        'N/A': 'N/A',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedComponent = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderComponent(
  element: React.ReactNode
): Promise<RenderedComponent> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
  })
  return { container, root }
}

async function unmountComponent(rendered: RenderedComponent) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('request timing display', () => {
  after(() => domWindow.close())

  test('renders the available stream phases including zero milliseconds', async () => {
    const presentation = buildTimingPresentation(9, undefined, {
      total_ms: 1500,
      gateway_ms: 100,
      upstream_first_data_ms: 400,
      first_data_to_client_ms: 0,
      client_stream_ms: 900,
      finalize_ms: 100,
    })
    const rendered = await renderComponent(
      <RequestTimingBreakdown phases={presentation.phases} />
    )

    const text = rendered.container.textContent ?? ''
    assert.equal(text.includes('Gateway processing'), true)
    assert.equal(text.includes('Upstream first data'), true)
    assert.equal(text.includes('First data to client'), true)
    assert.equal(text.includes('0.0s'), true)

    await unmountComponent(rendered)
  })

  test('retains timing values in the breakdown trigger accessible name', async () => {
    const rendered = await renderComponent(
      <TimingMetricsCell
        useTimeSec={9}
        completionTokens={12}
        frtMs={3200}
        isStream
        requestTiming={{
          total_ms: 1500,
          gateway_ms: 100,
          upstream_first_data_ms: 400,
          first_data_to_client_ms: 0,
          client_stream_ms: 900,
          finalize_ms: 100,
        }}
      />
    )

    const text = rendered.container.textContent ?? ''
    assert.equal(text.includes('0.5s'), true)
    assert.equal(text.includes('1.5s'), true)
    const trigger = rendered.container.querySelector('button')
    assert.ok(trigger)
    const accessibleName = trigger.getAttribute('aria-label') ?? ''
    assert.equal(accessibleName.includes('First token'), true)
    assert.equal(accessibleName.includes('0.5s'), true)
    assert.equal(accessibleName.includes('Duration'), true)
    assert.equal(accessibleName.includes('1.5s'), true)
    assert.equal(accessibleName.includes('Timing breakdown'), true)

    await unmountComponent(rendered)
  })

  test('shows the same phase breakdown in log details for a non-admin viewer', async () => {
    const log: UsageLog = {
      id: 1,
      user_id: 10,
      created_at: 1,
      type: 2,
      content: '',
      username: 'user',
      token_name: 'token',
      model_name: 'model',
      quota: 0,
      prompt_tokens: 1,
      completion_tokens: 2,
      use_time: 9,
      is_stream: true,
      channel: 0,
      channel_name: '',
      token_id: 1,
      group: 'default',
      ip: '',
      request_id: 'request-id',
      upstream_request_id: '',
      other: JSON.stringify({
        request_timing: {
          total_ms: 1500,
          gateway_ms: 100,
          upstream_first_data_ms: 400,
          first_data_to_client_ms: 0,
          client_stream_ms: 900,
          finalize_ms: 100,
        },
      }),
    }
    const rendered = await renderComponent(
      <DetailsDialog
        log={log}
        isAdmin={false}
        open
        onOpenChange={() => undefined}
      />
    )

    const text = document.body.textContent ?? ''
    assert.equal(text.includes('Gateway processing'), true)
    assert.equal(text.includes('Client streaming'), true)
    assert.equal(text.includes('0.5s'), true)

    await unmountComponent(rendered)
  })
})
