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
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLTextAreaElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
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
const i18next = (await import('i18next')).default
const { initReactI18next } = await import('react-i18next')
await i18next.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        JSON: 'JSON',
        'Invalid JSON': 'Invalid JSON',
        'Copied to clipboard': 'Copied to clipboard',
        'Failed to copy': 'Failed to copy',
        'Format JSON': 'Format JSON',
      },
    },
  },
})
const { JsonCodeEditor } = await import('../../json-code-editor')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedEditor = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderEditor(
  props: React.ComponentProps<typeof JsonCodeEditor>
): Promise<RenderedEditor> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<JsonCodeEditor {...props} />)
  })

  return { container, root }
}

async function unmountEditor(rendered: RenderedEditor) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

describe('JsonCodeEditor component', () => {
  after(() => {
    domWindow.close()
  })

  test('forwards form attributes and lifecycle callbacks to the textarea', async () => {
    const blurCalls: number[] = []
    const refValues: Array<HTMLTextAreaElement | null> = []
    const rendered = await renderEditor({
      value: '{"model":"gpt"}',
      onChange: () => undefined,
      id: 'json-input',
      name: 'model_config',
      placeholder: '{"model":"gpt"}',
      disabled: true,
      'aria-describedby': 'model-help',
      'aria-invalid': true,
      'data-form-root': 'settings-form',
      onBlur: () => blurCalls.push(1),
      textareaRef: (element) => refValues.push(element),
    })
    const textarea = rendered.container.querySelector('textarea')

    assert.ok(textarea)
    assert.equal(textarea.id, 'json-input')
    assert.equal(textarea.name, 'model_config')
    assert.equal(textarea.placeholder, '{"model":"gpt"}')
    assert.equal(textarea.disabled, true)
    assert.equal(textarea.getAttribute('aria-describedby'), 'model-help')
    assert.equal(textarea.getAttribute('aria-invalid'), 'true')
    assert.equal(textarea.getAttribute('data-form-root'), 'settings-form')

    await act(async () => textarea.dispatchEvent(new Event('blur')))
    assert.deepEqual(blurCalls, [1])
    assert.equal(refValues[0], textarea)

    await unmountEditor(rendered)
    assert.equal(refValues.at(-1), null)
  })

  test('emits user edits and synchronizes a controlled value', async () => {
    const changes: string[] = []
    const rendered = await renderEditor({
      value: '{"count":1}',
      onChange: (value) => changes.push(value),
    })
    const textarea = rendered.container.querySelector('textarea')

    assert.ok(textarea)
    await act(async () => {
      textarea.value = '{"count":2}'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.deepEqual(changes, ['{"count":2}'])

    await act(async () => {
      rendered.root.render(
        <JsonCodeEditor
          value='{"count":3}'
          onChange={(value) => changes.push(value)}
        />
      )
    })
    assert.equal(textarea.value, '{"count":3}')

    await unmountEditor(rendered)
  })

  test('formats valid JSON through the public toolbar action', async () => {
    const changes: string[] = []
    const rendered = await renderEditor({
      value: '{"model":{"ratio":2}}',
      onChange: (value) => changes.push(value),
    })
    const formatButton = [
      ...rendered.container.querySelectorAll('button'),
    ].find((button) => button.textContent?.includes('Format JSON'))

    assert.ok(formatButton)
    await act(async () => formatButton.click())
    assert.deepEqual(changes, ['{\n  "model": {\n    "ratio": 2\n  }\n}'])

    await unmountEditor(rendered)
  })
})
