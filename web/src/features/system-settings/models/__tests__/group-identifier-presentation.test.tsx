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
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
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
const { useForm } = await import('react-hook-form')
const { GroupRatioForm } = await import('../group-ratio-form')
const { GroupRatioVisualEditor } = await import('../group-ratio-visual-editor')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Group identifier': 'Group identifier',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const baseProps = {
  groupRatio: '{"default":1}',
  groupDisplayNames: '{"default":"Default"}',
  topupGroupRatio: '{}',
  userUsableGroups: '{"default":"Default group"}',
  groupGroupRatio: '{}',
  autoGroups: '[]',
  groupSpecialUsableGroup: '{}',
  onIdentifierValidityChange: () => undefined,
  onChange: () => undefined,
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  assert.ok(valueSetter)
  valueSetter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('group identifier presentation', () => {
  after(() => {
    domWindow.close()
  })

  test('switches an identifier from an input to text after it is saved', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <GroupRatioVisualEditor {...baseProps} savedGroupIdentifiers={[]} />
        </I18nextProvider>
      )
    })

    const identifierInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Group identifier"]'
    )
    assert.ok(identifierInput)
    assert.equal(identifierInput.value, 'default')
    assert.equal(container.querySelector('code[title="default"]'), null)

    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <GroupRatioVisualEditor
            {...baseProps}
            savedGroupIdentifiers={['default']}
          />
        </I18nextProvider>
      )
    })

    assert.equal(
      container.querySelector('input[aria-label="Group identifier"]'),
      null
    )
    assert.equal(
      container.querySelector('code[title="default"]')?.textContent,
      'default'
    )

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps a duplicate identifier draft out of serialized group data', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const groupRatioChanges: string[] = []
    let identifiersAreValid = true

    function Harness() {
      const [values, setValues] = useState({
        groupRatio: '{"vip":1}',
        groupDisplayNames: '{"vip":"VIP"}',
        topupGroupRatio: '{}',
        userUsableGroups: '{"vip":"VIP users"}',
        groupGroupRatio: '{}',
        autoGroups: '[]',
        groupSpecialUsableGroup: '{}',
      })

      return (
        <I18nextProvider i18n={i18n}>
          <GroupRatioVisualEditor
            {...values}
            savedGroupIdentifiers={['vip']}
            onIdentifierValidityChange={(isValid) => {
              identifiersAreValid = isValid
            }}
            onChange={(field, value) => {
              if (field === 'GroupRatio') groupRatioChanges.push(value)
              setValues((current) => ({ ...current, [field]: value }))
            }}
          />
        </I18nextProvider>
      )
    }

    await act(async () => root.render(<Harness />))

    const addButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Add group')
    )
    assert.ok(addButton)
    await act(async () => addButton.click())

    const identifierInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Group identifier"]'
    )
    assert.ok(identifierInput)

    await act(async () => setInputValue(identifierInput, 'vip'))
    await act(async () =>
      identifierInput.dispatchEvent(new Event('focusout', { bubbles: true }))
    )

    assert.equal(identifierInput.getAttribute('aria-invalid'), 'true')
    const identifierErrorId = identifierInput.getAttribute('aria-describedby')
    assert.ok(identifierErrorId)
    assert.equal(
      container.querySelector(`#${identifierErrorId}`)?.getAttribute('role'),
      'alert'
    )
    assert.equal(identifiersAreValid, false)

    const newRow = identifierInput.closest('tr')
    assert.ok(newRow)
    const ratioInput = newRow.querySelector<HTMLInputElement>(
      'input[type="number"]'
    )
    assert.ok(ratioInput)
    await act(async () => setInputValue(ratioInput, '2'))

    const serializedGroupRatio = JSON.parse(groupRatioChanges.at(-1) ?? '{}')
    const generatedIdentifier = Object.keys(serializedGroupRatio).find(
      (identifier) => identifier !== 'vip'
    )
    assert.ok(generatedIdentifier)
    assert.deepEqual(serializedGroupRatio, {
      vip: 1,
      [generatedIdentifier]: 2,
    })
    assert.equal(identifierInput.value, 'vip')
    assert.equal(identifiersAreValid, false)
    assert.equal(container.querySelectorAll('code[title="vip"]').length, 1)

    await act(async () => root.unmount())
    container.remove()
  })

  test('keeps group JSON fields editable in JSON mode', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    function Harness() {
      const form = useForm({
        defaultValues: {
          GroupRatio: '{"default":1}',
          GroupDisplayNames: '{"default":"Default"}',
          TopupGroupRatio: '{"default":1}',
          UserUsableGroups: '{"default":"Default group"}',
          GroupGroupRatio: '{}',
          AutoGroups: '[]',
          DefaultUseAutoGroup: false,
          GroupSpecialUsableGroup: '{}',
        },
      })

      return (
        <I18nextProvider i18n={i18n}>
          <GroupRatioForm
            form={form}
            onSave={async () => undefined}
            isSaving={false}
            savedGroupIdentifiers={['default']}
          />
        </I18nextProvider>
      )
    }

    await act(async () => root.render(<Harness />))

    const jsonModeButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Switch to JSON')
    )
    assert.ok(jsonModeButton)
    await act(async () => jsonModeButton.click())

    const editableFields = [
      'GroupRatio',
      'GroupDisplayNames',
      'TopupGroupRatio',
      'UserUsableGroups',
      'GroupGroupRatio',
      'AutoGroups',
      'GroupSpecialUsableGroup',
    ]
    for (const fieldName of editableFields) {
      assert.ok(container.querySelector(`textarea[name="${fieldName}"]`))
    }

    await act(async () => root.unmount())
    container.remove()
  })
})
