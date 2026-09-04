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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ImageConfig, ModelOption } from '../../../types'
import { PlaygroundImageStudio } from '../playground-image-studio'

const sendImageGeneration = vi.hoisted(() => vi.fn())

vi.mock('../../../api', () => ({
  sendImageGeneration,
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

const toastMock = vi.mocked((await import('sonner')).toast)

const imageConfig: ImageConfig = {
  model: 'dall-e-3',
  group: 'default',
  n: 1,
  size: 'auto',
  quality: 'auto',
  response_format: 'auto',
}

const models: ModelOption[] = [{ label: 'dall-e-3', value: 'dall-e-3' }]

function renderStudio() {
  return render(
    <PlaygroundImageStudio
      groups={[{ label: 'default', value: 'default', ratio: 1 }]}
      imageConfig={imageConfig}
      models={models}
      onImageConfigChange={() => undefined}
    />
  )
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  prompt = 'a red fox in snow'
) {
  await user.type(screen.getByLabelText('Prompt'), prompt)
  await user.click(screen.getByRole('button', { name: 'Generate' }))
}

beforeAll(() => {
  i18next.addResourceBundle('en', 'translation', {
    Prompt: 'Prompt',
    'Describe the image you want to generate':
      'Describe the image you want to generate',
    Model: 'Model',
    'Number of images': 'Number of images',
    Size: 'Size',
    Quality: 'Quality',
    'Response format': 'Response format',
    Generate: 'Generate',
    'Clear results': 'Clear results',
    'Generated image': 'Generated image',
    'Image generation returned no results':
      'Image generation returned no results',
    'No image models available': 'No image models available',
    Auto: 'Auto',
    Stop: 'Stop',
  })
})

beforeEach(() => {
  sendImageGeneration.mockReset()
  toastMock.error.mockClear()
})

describe('PlaygroundImageStudio results', () => {
  test('renders a URL result card with revised_prompt after success', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockResolvedValue({
      data: [
        {
          url: 'https://example.com/fox.png',
          revised_prompt: 'A red fox in a snowy field',
        },
      ],
    })

    renderStudio()
    await fillAndSubmit(user)

    const image = await screen.findByRole('img', {
      name: 'A red fox in a snowy field',
    })
    expect(image).toHaveAttribute('src', 'https://example.com/fox.png')
    expect(screen.getByText('A red fox in a snowy field')).toBeInTheDocument()
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(sendImageGeneration).toHaveBeenCalledTimes(1)
  })

  test('renders a b64 result as a data URI image', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockResolvedValue({
      data: [{ b64_json: 'QUJD', revised_prompt: 'Base64 fox' }],
    })

    renderStudio()
    await fillAndSubmit(user)

    const image = await screen.findByRole('img', { name: 'Base64 fox' })
    expect(image).toHaveAttribute('src', 'data:image/png;base64,QUJD')
  })

  test('does not render unsafe URLs as images', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockResolvedValue({
      data: [{ url: 'javascript:alert(1)' }],
    })

    renderStudio()
    await fillAndSubmit(user)

    await waitFor(() => {
      expect(screen.queryByRole('img')).toBeNull()
    })
  })

  test('shows a toast when generation returns no results', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockResolvedValue({ data: [] })

    renderStudio()
    await fillAndSubmit(user)

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'Image generation returned no results'
      )
    })
  })

  test('shows a toast with the relay error message on failure', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockRejectedValue(new Error('insufficient quota'))

    renderStudio()
    await fillAndSubmit(user)

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('insufficient quota')
    })
  })

  test('clears rendered results', async () => {
    const user = userEvent.setup()
    sendImageGeneration.mockResolvedValue({
      data: [{ url: 'https://example.com/fox.png' }],
    })

    renderStudio()
    await fillAndSubmit(user)
    await screen.findByRole('img', { name: 'Generated image' })

    await user.click(screen.getByRole('button', { name: 'Clear results' }))

    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('PlaygroundImageStudio abort', () => {
  test('stop button aborts the in-flight request', async () => {
    const user = userEvent.setup()
    let aborted = false
    sendImageGeneration.mockImplementation(
      (_payload: unknown, _group: unknown, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted = true
            reject(signal.reason)
          })
        })
    )

    renderStudio()
    await fillAndSubmit(user)

    const stop = await screen.findByRole('button', { name: 'Stop' })
    await user.click(stop)

    await waitFor(() => {
      expect(aborted).toBe(true)
    })
  })
})
