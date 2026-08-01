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
  'HTMLButtonElement',
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
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
const { AutoGroupOrderEditor } = await import('../auto-group-order-editor')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        '{{count}} / {{max}} groups selected':
          '{{count}} / {{max}} groups selected',
        'Add Auto group': 'Add Auto group',
        'Auto group order': 'Auto group order',
        'Drag {{group}} to reorder': 'Drag {{group}} to reorder',
        'Inherit global Auto order': 'Inherit global Auto order',
        'Maximum {{max}} groups selected': 'Maximum {{max}} groups selected',
        'Move {{group}} down': 'Move {{group}} down',
        'Move {{group}} up': 'Move {{group}} up',
        'No custom groups. Saving will inherit the complete global Auto order.':
          'No custom groups. Saving will inherit the complete global Auto order.',
        'Remove {{group}}': 'Remove {{group}}',
        'Restore global Auto': 'Restore global Auto',
        Ratio: 'Ratio',
        'Search...': 'Search...',
        'No group found.': 'No group found.',
        'Select a group': 'Select a group',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  const [groups, setGroups] = useState(['default', 'vip'])
  return (
    <I18nextProvider i18n={i18n}>
      <AutoGroupOrderEditor
        value={groups}
        options={[
          { value: 'auto', label: 'auto' },
          { value: 'default', label: 'default', ratio: 1 },
          { value: 'vip', label: 'vip', ratio: 2 },
          { value: 'team', label: 'team', ratio: 3 },
        ]}
        maxCount={2}
        onChange={setGroups}
      />
      <output data-testid='order'>{groups.join(',')}</output>
    </I18nextProvider>
  )
}

function findButton(container: ParentNode, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  )
  assert.ok(button)
  return button
}

describe('Auto group order editor', () => {
  after(() => {
    domWindow.close()
  })

  test('enforces the limit and exposes accessible reorder controls', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness />))

    const addButton = container.querySelector<HTMLButtonElement>(
      'button[role="combobox"]'
    )
    assert.ok(addButton)
    assert.equal(addButton.disabled, true)
    assert.equal(container.textContent?.includes('2 / 2 groups selected'), true)
    assert.ok(
      container.querySelector('[role="group"][aria-label="Auto group order"]')
    )
    assert.equal(
      findButton(container, 'Drag default to reorder').type,
      'button'
    )

    await act(async () => findButton(container, 'Move default down').click())
    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      'vip,default'
    )

    await act(async () => {
      findButton(container, 'Drag vip to reorder').dispatchEvent(
        new domWindow.KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        }) as unknown as KeyboardEvent
      )
    })
    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      'default,vip'
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('adds and removes groups, then restores inheritance as an empty value', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness />))
    await act(async () => findButton(container, 'Remove vip').click())

    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      'default'
    )
    const addButton = container.querySelector<HTMLButtonElement>(
      'button[role="combobox"]'
    )
    assert.ok(addButton)
    assert.equal(addButton.disabled, false)

    await act(async () => addButton.click())
    const teamOption = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ].find((option) => option.textContent?.includes('team'))
    assert.ok(teamOption)
    await act(async () => teamOption.click())
    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      'default,team'
    )
    assert.equal(addButton.disabled, true)

    const restoreButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Restore global Auto')
    )
    assert.ok(restoreButton)
    await act(async () => restoreButton.click())

    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      ''
    )
    assert.equal(
      container.textContent?.includes('Inherit global Auto order'),
      true
    )

    await act(async () => root.unmount())
    container.remove()
  })
})
