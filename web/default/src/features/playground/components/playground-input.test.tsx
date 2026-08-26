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
import * as suggestionModule from '@/components/ai-elements/suggestion'
import * as modelGroupSelectorModule from '@/components/model-group-selector'
import type { MediaGenerationProfile } from '../lib'

type CapturedSuggestionProps = React.ComponentProps<
  typeof suggestionModule.Suggestion
>

type ModelGroupSelectorProps = React.ComponentProps<
  typeof modelGroupSelectorModule.ModelGroupSelector
>

let capturedSelectorProps: ModelGroupSelectorProps | undefined
let capturedSuggestionProps: CapturedSuggestionProps[] = []

spyOn(suggestionModule, 'Suggestion').mockImplementation(((
  props: CapturedSuggestionProps
) => {
  capturedSuggestionProps.push(props)
  return React.createElement('button', { type: 'button' }, props.suggestion)
}) as never)

spyOn(modelGroupSelectorModule, 'ModelGroupSelector').mockImplementation(((
  props: ModelGroupSelectorProps
) => {
  capturedSelectorProps = props
  return null
}) as never)

// Render the closed dropdown contents in the server-rendered test markup so
// attachment menu entries can be asserted without a browser interaction.
mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    render,
    children,
  }: {
    render?: React.ReactNode
    children?: React.ReactNode
  }) => <>{render ?? children}</>,
}))

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
  capturedSuggestionProps = []
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
  mediaProfile,
  models = [
    { label: 'GPT Image 2', value: 'gpt-image-2' },
    { label: 'Seedance 2.5', value: 'seedance-2.5' },
  ],
}: {
  initialText?: string
  modelLocked?: boolean
  mediaProfile?: Pick<MediaGenerationProfile, 'kind'>
  models?: Array<{ label: string; value: string }>
} = {}) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <PlaygroundInput
        disabled={false}
        groupValue='default'
        groups={[]}
        initialText={initialText}
        mediaProfile={mediaProfile as MediaGenerationProfile | undefined}
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
  test('submits a media prompt with its exact target model', () => {
    const onSubmit = mock(() => undefined)
    const onModelChange = mock(() => undefined)

    renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundInput
          disabled={false}
          groupValue='default'
          groups={[]}
          modelLocked
          modelValue='gpt-image-2'
          models={[
            { label: 'GPT Image 2', value: 'gpt-image-2' },
            { label: 'Seedance 2.5', value: 'seedance-2.5' },
          ]}
          onGroupChange={() => undefined}
          onModelChange={onModelChange}
          onSubmit={onSubmit}
          showGroupSelector={false}
          submitDisabled={false}
        />
      </I18nextProvider>
    )

    const videoSuggestion = capturedSuggestionProps.find(
      (props) => props.suggestion === 'Generate a video'
    )
    if (!videoSuggestion?.onClick) {
      throw new Error('Video quick-start suggestion was not rendered')
    }

    videoSuggestion.onClick('Generate a video')

    expect(onModelChange).toHaveBeenCalledWith('seedance-2.5')
    expect(onSubmit).toHaveBeenCalledWith('Generate a video', 'seedance-2.5')
  })

  test('routes a text prompt to the preferred text model', () => {
    const onSubmit = mock(() => undefined)
    const onModelChange = mock(() => undefined)

    renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <PlaygroundInput
          disabled={false}
          groupValue='default'
          groups={[]}
          modelValue='gpt-4o'
          models={[
            { label: 'GPT-4o', value: 'gpt-4o' },
            { label: 'GPT-5.5', value: 'gpt-5.5' },
          ]}
          onGroupChange={() => undefined}
          onModelChange={onModelChange}
          onSubmit={onSubmit}
          showGroupSelector={false}
          submitDisabled={false}
        />
      </I18nextProvider>
    )

    const textSuggestion = capturedSuggestionProps.find(
      (props) => props.suggestion === 'Analyze data'
    )
    if (!textSuggestion?.onClick) {
      throw new Error('Text quick-start suggestion was not rendered')
    }

    textSuggestion.onClick('Analyze data')

    expect(onModelChange).toHaveBeenCalledWith('gpt-5.5')
    expect(onSubmit).toHaveBeenCalledWith('Analyze data', 'gpt-5.5')
  })

  test('shows image and video quick starts for a blank prompt', () => {
    const markup = renderPlaygroundMarkup()

    expect(markup).toContain('Try one of these to get started:')
    expect(markup).toContain('Create an image')
    expect(markup).toContain('Generate a video')
  })

  test('keeps quick starts visible while the prompt contains text', () => {
    const markup = renderPlaygroundMarkup({ initialText: 'already typing' })

    expect(markup).toContain('Try one of these to get started:')
    expect(markup).toContain('Create an image')
    expect(markup).toContain('Generate a video')
  })

  test('hides unavailable media quick starts but keeps locked media actions', () => {
    const withoutImage = renderPlaygroundMarkup({
      models: [{ label: 'Seedance 2.5', value: 'seedance-2.5' }],
    })
    const locked = renderPlaygroundMarkup({ modelLocked: true })

    expect(withoutImage).not.toContain('Create an image')
    expect(withoutImage).toContain('Generate a video')
    expect(locked).toContain('Create an image')
    expect(locked).toContain('Generate a video')
  })

  test('hides a video quick start when only another video model is visible', () => {
    const staleVideoOnly = renderPlaygroundMarkup({
      models: [{ label: 'Seedance 2.0', value: 'seedance-2.0' }],
    })

    expect(staleVideoOnly).not.toContain('Generate a video')
  })
})

describe('PlaygroundInput attachments', () => {
  test('advertises the supported text-model attachment types', () => {
    const markup = renderPlaygroundMarkup()

    expect(markup).toContain(
      'accept="application/pdf,text/csv,text/comma-separated-values,image/jpeg,image/png,image/webp,video/mp4,.pdf,.csv,.jpg,.jpeg,.png,.webp,.mp4"'
    )
    expect(markup).toContain('aria-label="Upload files"')
  })

  test('uses model-specific image and video filters', () => {
    const imageMarkup = renderPlaygroundMarkup({
      mediaProfile: { kind: 'image' },
    })
    const videoMarkup = renderPlaygroundMarkup({
      mediaProfile: { kind: 'video' },
    })

    expect(imageMarkup).toContain(
      'accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"'
    )
    expect(videoMarkup).toContain(
      'accept="image/jpeg,image/png,image/webp,video/mp4,.jpg,.jpeg,.png,.webp,.mp4"'
    )
    expect(imageMarkup).toContain('Upload files')
    expect(imageMarkup).not.toContain('Take screenshot')
    expect(imageMarkup).not.toContain('Take photo')
  })
})
