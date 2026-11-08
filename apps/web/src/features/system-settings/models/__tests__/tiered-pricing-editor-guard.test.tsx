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
import { afterAll, describe, test } from 'bun:test'
import assert from 'node:assert/strict'

import type React from 'react'

import { resetSharedDomWindow } from '@/test-utils/happy-dom-env'

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TieredPricingEditor } = await import('../tiered-pricing-editor')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {},
    },
  },
})

// An expression the visual parser cannot round-trip (fixed() is outside its
// grammar). Reopening a model saved with it used to regenerate "p * 0 + c * 0"
// into the draft, and saving then silently billed the model at 0×0.
const UNPARSABLE_EXPR = 'tier("base", p * 2 + c * 8 + fixed(0.05))'

type EditorProps = React.ComponentProps<typeof TieredPricingEditor>

type RenderedEditor = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
  billingExprCalls: string[]
  requestRuleCalls: string[]
}

async function renderEditor(
  overrides: Partial<EditorProps> = {}
): Promise<RenderedEditor> {
  const billingExprCalls: string[] = []
  const requestRuleCalls: string[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  const props: EditorProps = {
    modelName: 'test-expr-model',
    billingExpr: '',
    requestRuleExpr: '',
    onBillingExprChange: (next) => billingExprCalls.push(next),
    onRequestRuleExprChange: (next) => requestRuleCalls.push(next),
    ...overrides,
  }

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <TieredPricingEditor {...props} />
      </I18nextProvider>
    )
  })

  return { container, root, billingExprCalls, requestRuleCalls }
}

async function unmountEditor(rendered: RenderedEditor) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

async function typeRawExpr(rendered: RenderedEditor, value: string) {
  const textarea = rendered.container.querySelector('textarea')
  assert.ok(textarea, 'expected the raw expression textarea to render')
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set
  assert.ok(nativeSetter, 'textarea value setter unavailable')
  await act(async () => {
    nativeSetter.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('tiered pricing editor draft guard', () => {
  afterAll(async () => {
    await resetSharedDomWindow()
  })

  test('reopening an unparsable expression never rewrites the draft', async () => {
    const rendered = await renderEditor({ billingExpr: UNPARSABLE_EXPR })

    const zeroPushes = rendered.billingExprCalls.filter(
      (value) => value.includes('p * 0 + c * 0') || value === ''
    )
    assert.deepEqual(
      zeroPushes,
      [],
      `mount must not push the zero placeholder, got: ${rendered.billingExprCalls.join(' | ')}`
    )

    await unmountEditor(rendered)
  })

  test('a pristine default view does not push the zero placeholder', async () => {
    const rendered = await renderEditor({ billingExpr: '' })

    assert.deepEqual(
      rendered.billingExprCalls,
      [],
      `empty draft must stay untouched on mount, got: ${rendered.billingExprCalls.join(' | ')}`
    )

    await unmountEditor(rendered)
  })

  test('raw expression edits still reach the draft', async () => {
    const rendered = await renderEditor({ billingExpr: UNPARSABLE_EXPR })

    await typeRawExpr(rendered, 'tier("base", p * 1 + c * 2)')

    assert.equal(
      rendered.billingExprCalls.includes('tier("base", p * 1 + c * 2)'),
      true,
      `raw edits must push, got: ${rendered.billingExprCalls.join(' | ')}`
    )

    await unmountEditor(rendered)
  })

  test('request rules survive a mount that cannot parse them', async () => {
    const rendered = await renderEditor({
      billingExpr: UNPARSABLE_EXPR,
      requestRuleExpr: '(param("service_tier") == "priority" ? 2 : 1)',
    })

    assert.deepEqual(
      rendered.requestRuleCalls,
      [],
      `mount must not wipe unparsable rules, got: ${rendered.requestRuleCalls.join(' | ')}`
    )

    await unmountEditor(rendered)
  })
})
