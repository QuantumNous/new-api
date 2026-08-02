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

let shouldReduceMotion = false
const reducedMotionMediaQuery = domWindow.matchMedia('(prefers-reduced-motion)')
Object.defineProperty(reducedMotionMediaQuery, 'matches', {
  configurable: true,
  get: () => shouldReduceMotion,
})
Object.defineProperty(domWindow, 'matchMedia', {
  configurable: true,
  value: () => reducedMotionMediaQuery,
})

function setReducedMotion(value: boolean) {
  shouldReduceMotion = value
  reducedMotionMediaQuery.dispatchEvent(new domWindow.Event('change'))
}

const { act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ApiKeyGroupCombobox } = await import('../api-key-group-combobox')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Auto: 'Auto',
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

const options = [
  {
    value: 'auto',
    label: 'auto',
    desc: 'Global automatic routing',
    ratio: '自动',
  },
  { value: 'default', label: 'default', desc: 'User group', ratio: 1 },
  { value: 'vip', label: 'vip', desc: 'Priority group', ratio: 3 },
]

function Harness(props: { initialValue: string }) {
  const [value, setValue] = useState(props.initialValue)

  return (
    <I18nextProvider i18n={i18n}>
      <ApiKeyGroupCombobox
        options={options}
        value={value}
        onValueChange={setValue}
      />
      <output data-testid='selected-group'>{value}</output>
    </I18nextProvider>
  )
}

function getTrigger(container: ParentNode): HTMLButtonElement {
  const trigger = container.querySelector<HTMLButtonElement>(
    'button[role="combobox"]'
  )
  assert.ok(trigger)
  return trigger
}

function getCommandItem(label: string): HTMLElement {
  const item = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
  ].find((candidate) => candidate.textContent?.includes(label))
  assert.ok(item)
  return item
}

describe('API key group combobox Auto effect', () => {
  after(() => {
    domWindow.close()
  })

  test('rings the selected Auto trigger and its localized ratio without rendering the API ratio text', async () => {
    setReducedMotion(false)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness initialValue='auto' />))

    const trigger = getTrigger(container)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(trigger.dataset.autoGroupEffect, 'trigger')
    assert.equal(trigger.classList.contains('bg-linear-to-r'), false)
    assert.equal(trigger.classList.contains('overflow-hidden'), false)
    assert.equal(trigger.classList.contains('overflow-visible'), true)

    const triggerFlowBorder = trigger.querySelector<HTMLElement>(
      '[data-auto-group-flow-border]'
    )
    assert.ok(triggerFlowBorder)
    assert.equal(triggerFlowBorder.getAttribute('aria-hidden'), 'true')
    assert.equal(
      triggerFlowBorder.classList.contains('pointer-events-none'),
      true
    )
    assert.equal(
      triggerFlowBorder.classList.contains('auto-group-flow-border'),
      true
    )

    const triggerRatio = trigger.querySelector<HTMLElement>(
      '[data-auto-group-effect="ratio"]'
    )
    assert.ok(triggerRatio)
    assert.equal(triggerRatio.textContent, 'Auto Ratio')
    assert.equal(triggerRatio.textContent?.includes('Auto'), true)
    assert.equal(triggerRatio.textContent?.includes('x'), false)
    assert.equal(trigger.textContent?.includes('自动'), false)
    assert.equal(triggerRatio.classList.contains('relative'), true)
    assert.equal(triggerRatio.classList.contains('overflow-visible'), true)
    assert.equal(triggerRatio.classList.contains('rounded-4xl'), true)
    assert.ok(triggerRatio.querySelector('[data-auto-group-flow-border]'))

    await act(async () => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')

    const autoOption = getCommandItem('Global automatic routing')
    assert.equal(autoOption.dataset.autoGroupEffect, 'option')
    assert.equal(autoOption.getAttribute('aria-selected'), 'true')
    assert.equal(autoOption.classList.contains('bg-linear-to-r'), false)
    assert.equal(autoOption.classList.contains('overflow-visible'), true)
    assert.ok(autoOption.querySelector('[data-auto-group-flow-border]'))
    const optionRatio = autoOption.querySelector<HTMLElement>(
      '[data-auto-group-effect="ratio"]'
    )
    assert.ok(optionRatio)
    assert.equal(optionRatio.textContent, 'Auto Ratio')
    assert.ok(optionRatio.querySelector('[data-auto-group-flow-border]'))

    const defaultOption = getCommandItem('User group')
    assert.equal(defaultOption.hasAttribute('data-auto-group-effect'), false)
    assert.equal(
      defaultOption.querySelector('[data-auto-group-flow-border]'),
      null
    )
    assert.equal(defaultOption.textContent?.includes('1x Ratio'), true)
    assert.equal(
      defaultOption.querySelector('[data-auto-group-effect="ratio"]'),
      null
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps search and selection behavior while leaving normal groups unstyled', async () => {
    setReducedMotion(false)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness initialValue='auto' />))

    const trigger = getTrigger(container)
    await act(async () => trigger.click())

    const searchInput = document.querySelector<HTMLInputElement>(
      'input[placeholder="Search..."]'
    )
    assert.ok(searchInput)
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        domWindow.HTMLInputElement.prototype,
        'value'
      )?.set
      assert.ok(valueSetter)
      valueSetter.call(searchInput, 'vip')
      searchInput.dispatchEvent(
        new domWindow.Event('input', { bubbles: true }) as unknown as Event
      )
    })

    const visibleOptions = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ]
    assert.equal(
      visibleOptions.some((option) =>
        option.textContent?.includes('Global automatic routing')
      ),
      false
    )
    const vipOption = getCommandItem('Priority group')
    await act(async () => vipOption.click())

    assert.equal(
      container.querySelector('[data-testid="selected-group"]')?.textContent,
      'vip'
    )
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(trigger.hasAttribute('data-auto-group-effect'), false)
    assert.equal(trigger.querySelector('[data-auto-group-flow-border]'), null)

    await act(async () => root.unmount())
    container.remove()
  })

  test('preserves the static Auto treatment but omits moving layers for reduced motion', async () => {
    setReducedMotion(true)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<Harness initialValue='auto' />))

    const trigger = getTrigger(container)
    assert.equal(trigger.dataset.autoGroupEffect, 'trigger')
    assert.equal(trigger.querySelector('[data-auto-group-flow-border]'), null)
    assert.ok(trigger.querySelector('[data-auto-group-effect="ratio"]'))

    await act(async () => trigger.click())
    const autoOption = getCommandItem('Global automatic routing')
    assert.equal(autoOption.dataset.autoGroupEffect, 'option')
    assert.equal(
      autoOption.querySelector('[data-auto-group-flow-border]'),
      null
    )
    assert.ok(autoOption.querySelector('[data-auto-group-effect="ratio"]'))

    await act(async () => root.unmount())
    container.remove()
    setReducedMotion(false)
  })
})
