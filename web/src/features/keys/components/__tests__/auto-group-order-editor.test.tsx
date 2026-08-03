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
        'No available groups in the global Auto order.':
          'No available groups in the global Auto order.',
        'No valid custom Auto groups remain. Add a group or restore global Auto.':
          'No valid custom Auto groups remain. Add a group or restore global Auto.',
        'No custom groups. Saving will inherit the complete global Auto order.':
          'No custom groups. Saving will inherit the complete global Auto order.',
        'Remove {{group}}': 'Remove {{group}}',
        'Restore global Auto': 'Restore global Auto',
        Ratio: 'Ratio',
        'Search...': 'Search...',
        'No group found.': 'No group found.',
        'Select a group': 'Select a group',
        'Using the complete global Auto order ({{count}} groups)':
          'Using the complete global Auto order ({{count}} groups)',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const globalOptions = [
  { value: 'vip', label: 'VIP', desc: 'Priority access', ratio: 3 },
  { value: 'default', label: 'Default', desc: 'Standard access', ratio: 1 },
  { value: 'team', label: 'Team', desc: 'Shared access', ratio: 2 },
]

function Harness(props: { initialGroups?: string[] }) {
  const [groups, setGroups] = useState(
    props.initialGroups ?? ['default', 'vip']
  )
  const [mode, setMode] = useState<'inherit' | 'custom'>('custom')
  return (
    <I18nextProvider i18n={i18n}>
      <AutoGroupOrderEditor
        value={groups}
        mode={mode}
        options={[
          { value: 'auto', label: 'auto' },
          { value: 'default', label: 'default', ratio: 1 },
          { value: 'vip', label: 'vip', ratio: 2 },
          { value: 'team', label: 'team', ratio: 3 },
        ]}
        globalOptions={globalOptions}
        maxCount={2}
        onChange={(value) => {
          setGroups(value.groups)
          setMode(value.mode)
        }}
      />
      <output data-testid='order'>{groups.join(',')}</output>
      <output data-testid='mode'>{mode}</output>
    </I18nextProvider>
  )
}

function InheritanceHarness(props: { globalOptions?: typeof globalOptions }) {
  const [groups, setGroups] = useState<string[]>([])
  const [mode, setMode] = useState<'inherit' | 'custom'>('inherit')

  return (
    <I18nextProvider i18n={i18n}>
      <AutoGroupOrderEditor
        value={groups}
        mode={mode}
        options={[{ value: 'auto', label: 'auto' }, ...globalOptions]}
        globalOptions={props.globalOptions ?? globalOptions}
        maxCount={2}
        onChange={(value) => {
          setGroups(value.groups)
          setMode(value.mode)
        }}
      />
      <output data-testid='order'>{groups.join(',')}</output>
      <output data-testid='mode'>{mode}</output>
    </I18nextProvider>
  )
}

function CustomEmptyHarness() {
  const [groups, setGroups] = useState<string[]>([])
  const [mode, setMode] = useState<'inherit' | 'custom'>('custom')

  return (
    <I18nextProvider i18n={i18n}>
      <AutoGroupOrderEditor
        value={groups}
        mode={mode}
        options={[{ value: 'auto', label: 'auto' }, ...globalOptions]}
        globalOptions={globalOptions}
        maxCount={2}
        onChange={(value) => {
          setGroups(value.groups)
          setMode(value.mode)
        }}
      />
      <output data-testid='order'>{groups.join(',')}</output>
      <output data-testid='mode'>{mode}</output>
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
      container.querySelector('[data-testid="mode"]')?.textContent,
      'inherit'
    )
    assert.equal(
      container.textContent?.includes(
        'Using the complete global Auto order (3 groups)'
      ),
      true
    )

    const inheritedItems = container.querySelectorAll(
      '[data-slot="global-auto-order"] > li'
    )
    assert.deepEqual(
      [...inheritedItems].map(
        (item) =>
          item.querySelector('[data-slot="global-auto-order-name"]')
            ?.textContent
      ),
      ['VIP', 'Default', 'Team']
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('shows the complete inherited order with metadata beyond the custom limit', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<InheritanceHarness />))

    assert.equal(
      container.textContent?.includes(
        'Using the complete global Auto order (3 groups)'
      ),
      true
    )
    assert.equal(
      container.textContent?.includes('0 / 2 groups selected'),
      false
    )

    const order = container.querySelector<HTMLOListElement>(
      '[data-slot="global-auto-order"]'
    )
    assert.ok(order)
    assert.equal(order.classList.contains('overflow-y-auto'), true)
    assert.equal(order.classList.contains('flex-wrap'), true)

    const items = [...order.querySelectorAll('li')]
    assert.equal(items.length, 3)
    assert.equal(
      order.querySelectorAll('[data-slot="global-auto-order-connector"]')
        .length,
      2
    )
    assert.deepEqual(
      items.map((item) => ({
        index: item.querySelector('[data-slot="global-auto-order-index"]')
          ?.textContent,
        name: item.querySelector('[data-slot="global-auto-order-name"]')
          ?.textContent,
        title: item
          .querySelector('[data-slot="global-auto-order-chip"]')
          ?.getAttribute('title'),
        description: item.querySelector(
          '[data-slot="global-auto-order-description"]'
        )?.textContent,
        ratio: item.querySelector('[data-slot="badge"]')?.textContent,
      })),
      [
        {
          index: '1',
          name: 'VIP',
          title: 'Priority access',
          description: 'Priority access',
          ratio: '3x Ratio',
        },
        {
          index: '2',
          name: 'Default',
          title: 'Standard access',
          description: 'Standard access',
          ratio: '1x Ratio',
        },
        {
          index: '3',
          name: 'Team',
          title: 'Shared access',
          description: 'Shared access',
          ratio: '2x Ratio',
        },
      ]
    )

    for (const item of items) {
      const chip = item.querySelector('[data-slot="global-auto-order-chip"]')
      assert.ok(chip)
      const description = item.querySelector(
        '[data-slot="global-auto-order-description"]'
      )
      assert.ok(description)
      assert.equal(description.classList.contains('sr-only'), true)
    }

    assert.equal(
      items[0]?.querySelector('[data-slot="global-auto-order-connector"]'),
      null
    )
    for (const item of items.slice(1)) {
      const connector = item.querySelector(
        '[data-slot="global-auto-order-connector"]'
      )
      assert.ok(connector)
      assert.equal(connector.getAttribute('aria-hidden'), 'true')
    }

    assert.equal(container.querySelector('[aria-label^="Drag "]'), null)
    assert.equal(container.querySelector('[aria-label^="Move "]'), null)
    assert.equal(container.querySelector('[aria-label^="Remove "]'), null)

    const restoreButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Restore global Auto')
    )
    assert.ok(restoreButton)
    assert.equal(restoreButton.disabled, true)

    await act(async () => root.unmount())
    container.remove()
  })

  test('shows an explicit empty state when the global Auto order has no groups', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () =>
      root.render(<InheritanceHarness globalOptions={[]} />)
    )

    assert.equal(
      container.textContent?.includes(
        'Using the complete global Auto order (0 groups)'
      ),
      true
    )
    assert.equal(
      container.textContent?.includes(
        'No available groups in the global Auto order.'
      ),
      true
    )
    assert.equal(
      container.querySelector('[data-slot="global-auto-order"]'),
      null
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps an empty custom order distinct from global inheritance', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<CustomEmptyHarness />))

    assert.equal(
      container.querySelector('[data-testid="mode"]')?.textContent,
      'custom'
    )
    assert.equal(
      container.textContent?.includes(
        'No valid custom Auto groups remain. Add a group or restore global Auto.'
      ),
      true
    )
    assert.equal(
      container.querySelector('[data-slot="global-auto-order"]'),
      null
    )

    const restoreButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Restore global Auto')
    )
    assert.ok(restoreButton)
    assert.equal(restoreButton.disabled, false)
    await act(async () => restoreButton.click())

    assert.equal(
      container.querySelector('[data-testid="mode"]')?.textContent,
      'inherit'
    )
    assert.ok(container.querySelector('[data-slot="global-auto-order"]'))

    await act(async () => root.unmount())
    container.remove()
  })

  test('adding a group from inheritance explicitly creates a custom order', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<InheritanceHarness />))

    const addButton = container.querySelector<HTMLButtonElement>(
      'button[role="combobox"]'
    )
    assert.ok(addButton)
    await act(async () => addButton.click())
    const vipOption = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ].find((option) => option.textContent?.includes('VIP'))
    assert.ok(vipOption)
    await act(async () => vipOption.click())

    assert.equal(
      container.querySelector('[data-testid="mode"]')?.textContent,
      'custom'
    )
    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      'vip'
    )
    assert.equal(
      container.querySelector('[data-slot="global-auto-order"]'),
      null
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('removing the last custom group does not silently enable inheritance', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness initialGroups={['default']} />))
    await act(async () => findButton(container, 'Remove default').click())

    assert.equal(
      container.querySelector('[data-testid="order"]')?.textContent,
      ''
    )
    assert.equal(
      container.querySelector('[data-testid="mode"]')?.textContent,
      'custom'
    )
    assert.equal(
      container.textContent?.includes(
        'No valid custom Auto groups remain. Add a group or restore global Auto.'
      ),
      true
    )

    await act(async () => root.unmount())
    container.remove()
  })
})
