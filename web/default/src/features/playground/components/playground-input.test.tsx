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
import * as React from 'react'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import * as modelGroupSelectorModule from '@/components/model-group-selector'

type ModelGroupSelectorProps = React.ComponentProps<
  typeof modelGroupSelectorModule.ModelGroupSelector
>

let capturedSelectorProps: ModelGroupSelectorProps | undefined

spyOn(modelGroupSelectorModule, 'ModelGroupSelector').mockImplementation(((
  props: ModelGroupSelectorProps
) => {
  capturedSelectorProps = props
  return null
}) as never)

const { PlaygroundInput } = await import('./playground-input')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  capturedSelectorProps = undefined
})

afterAll(() => {
  mock.restore()
})

function renderPlaygroundInput(modelLocked: boolean) {
  renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <PlaygroundInput
        disabled={false}
        groupValue='default'
        groups={[]}
        isModelLoading={false}
        modelLocked={modelLocked}
        modelValue='gpt-image-2'
        models={[{ label: 'GPT Image 2', value: 'gpt-image-2' }]}
        onGroupChange={() => undefined}
        onModelChange={() => undefined}
        onSubmit={() => undefined}
        showGroupSelector={false}
        submitDisabled={false}
      />
    </I18nextProvider>
  )

  if (!capturedSelectorProps) {
    throw new Error('ModelGroupSelector was not rendered')
  }

  return capturedSelectorProps
}

function renderPlaygroundMarkup({
  initialText,
  modelLocked = false,
  models = [
    { label: 'GPT Image 2', value: 'gpt-image-2' },
    { label: 'Seedance 2.0', value: 'seedance-2.0' },
  ],
}: {
  initialText?: string
  modelLocked?: boolean
  models?: Array<{ label: string; value: string }>
} = {}) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <PlaygroundInput
        disabled={false}
        groupValue='default'
        groups={[]}
        initialText={initialText}
        modelLocked={modelLocked}
        modelValue={models[0]?.value ?? ''}
        models={models}
        onGroupChange={() => undefined}
        onModelChange={() => undefined}
        onSubmit={() => undefined}
        showGroupSelector={false}
        submitDisabled={false}
      />
    </I18nextProvider>
  )
}

describe('PlaygroundInput model lock', () => {
  test('disables the combined model and group selector while the model is locked', () => {
    expect(renderPlaygroundInput(true).disabled).toBe(true)
  })

  test('leaves the combined model and group selector enabled when the model is not locked', () => {
    expect(renderPlaygroundInput(false).disabled).toBe(false)
  })
})

describe('PlaygroundInput quick starts', () => {
  test('shows image and video quick starts for a blank prompt', () => {
    const markup = renderPlaygroundMarkup()

    expect(markup).toContain('Try one of these to get started:')
    expect(markup).toContain('Create an image')
    expect(markup).toContain('Generate a video')
  })

  test('hides quick starts while the prompt contains text', () => {
    const markup = renderPlaygroundMarkup({ initialText: 'already typing' })

    expect(markup).not.toContain('Try one of these to get started:')
    expect(markup).not.toContain('Create an image')
    expect(markup).not.toContain('Generate a video')
  })

  test('hides unavailable and locked media quick starts', () => {
    const withoutImage = renderPlaygroundMarkup({
      models: [{ label: 'Seedance 2.5', value: 'seedance-2.5' }],
    })
    const locked = renderPlaygroundMarkup({ modelLocked: true })

    expect(withoutImage).not.toContain('Create an image')
    expect(withoutImage).toContain('Generate a video')
    expect(locked).not.toContain('Create an image')
    expect(locked).not.toContain('Generate a video')
  })
})

describe('PlaygroundInput attachments', () => {
  test('advertises the supported photo and text attachment types', () => {
    const markup = renderPlaygroundMarkup()

    expect(markup).toContain('accept="image/*,.txt,.md,.csv,.json"')
    expect(markup).toContain('aria-label="Upload files"')
  })
})
