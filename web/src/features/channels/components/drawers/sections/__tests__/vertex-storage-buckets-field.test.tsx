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
import type React from 'react'

const domWindow = new Window()
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'InputEvent',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'PointerEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const) {
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
const { Form } = await import('@/components/ui/form')
const { VertexStorageBucketsField } =
  await import('../vertex-storage-buckets-field')

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Storage buckets': 'Storage buckets',
        'Configure Google Cloud Storage buckets for this Vertex AI channel.':
          'Configure Google Cloud Storage buckets for this Vertex AI channel.',
        'Enter storage bucket names': 'Enter storage bucket names',
        'Add storage bucket "{{value}}"': 'Add storage bucket "{{value}}"',
      },
    },
  },
})

type RenderFieldOptions = {
  channelType: number
  models: string[]
}

function FormHarness(props: { children: React.ReactNode }) {
  const form = useForm()
  return <Form {...form}>{props.children}</Form>
}

function FieldHarness(props: RenderFieldOptions) {
  const [models, setModels] = useState(props.models)
  return (
    <>
      <VertexStorageBucketsField
        channelType={props.channelType}
        models={models}
        onModelsChange={setModels}
      />
      <output data-testid='models-value'>{models.join(',')}</output>
    </>
  )
}

async function render(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <FormHarness>{node}</FormHarness>
      </I18nextProvider>
    )
  })
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

async function enterText(input: HTMLInputElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      domWindow.HTMLInputElement.prototype,
      'value'
    )
    descriptor?.set?.call(input, value)
    input.dispatchEvent(
      new domWindow.Event('input', { bubbles: true }) as unknown as Event
    )
    await domWindow.happyDOM.waitUntilComplete()
  })
}

describe('Vertex storage buckets field', () => {
  after(() => domWindow.close())

  test('renders only for Vertex AI channel type 41', async () => {
    const vertex = await render(
      <VertexStorageBucketsField
        channelType={41}
        models={['gemini-2.5-pro']}
        onModelsChange={() => undefined}
      />
    )
    assert.match(vertex.container.textContent ?? '', /Storage buckets/)
    await vertex.unmount()

    const gemini = await render(
      <VertexStorageBucketsField
        channelType={24}
        models={['gemini-2.5-pro']}
        onModelsChange={() => undefined}
      />
    )
    assert.equal(gemini.container.textContent, '')
    await gemini.unmount()
  })

  test('shows only valid existing buckets without the storage prefix', async () => {
    const rendered = await render(
      <VertexStorageBucketsField
        channelType={41}
        models={[
          'gemini-2.5-pro',
          'storage:gs:bucket-a/path',
          'storage:gs:bucket-b',
        ]}
        onModelsChange={() => undefined}
      />
    )
    const chips = [
      ...rendered.container.querySelectorAll('[data-slot="combobox-chip"]'),
    ].map((chip) => chip.textContent)
    assert.deepEqual(chips, ['bucket-b'])
    await rendered.unmount()
  })

  test('adds valid buckets and ignores path values', async () => {
    const rendered = await render(
      <FieldHarness channelType={41} models={['gemini-2.5-pro']} />
    )
    const input = rendered.container.querySelector<HTMLInputElement>(
      '[aria-label="Enter storage bucket names"]'
    )
    assert.ok(input)

    await enterText(input, 'bucket-a,bucket-b/path,bucket-c,')

    assert.equal(
      rendered.container.querySelector('[data-testid="models-value"]')
        ?.textContent,
      'gemini-2.5-pro,storage:gs:bucket-a,storage:gs:bucket-c'
    )
    await rendered.unmount()
  })
})
