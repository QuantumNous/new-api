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
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PlaygroundInput } from '../playground-input'
import type { PlaygroundConfig } from '../../../types'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const config: PlaygroundConfig = {
  model: 'gpt-test',
  group: '',
  temperature: 1,
  top_p: 1,
  max_tokens: 1024,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

function renderInput(onSubmit = vi.fn()) {
  render(
    <PlaygroundInput
      config={config}
      groups={[]}
      groupValue=''
      modelValue='gpt-test'
      models={[{ label: 'gpt-test', value: 'gpt-test' }]}
      onConfigChange={() => undefined}
      onGroupChange={() => undefined}
      onModelChange={() => undefined}
      onParameterEnabledChange={() => undefined}
      onSubmit={onSubmit}
      parameterEnabled={{
        temperature: false,
        top_p: false,
        max_tokens: false,
        frequency_penalty: false,
        presence_penalty: false,
        seed: false,
      }}
    />
  )

  return onSubmit
}

/**
 * The hidden picker owned by the attach button. `PromptInput` renders a second
 * hidden file input of its own, so match on `accept` to pick the right one.
 */
function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="file"][accept*=".pdf"]'
  )
  if (!input) throw new Error('attachment file input not rendered')

  return input
}

/** The composer's submit control (a second button also matches "send"). */
function submitButton(): HTMLElement {
  const button = document.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  )
  if (!button) throw new Error('submit button not rendered')

  return button
}

describe('PlaygroundInput attachments', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Ask anything': 'Ask anything',
      'Attach files': 'Attach files',
      'Could not read file': 'Could not read file',
      'Extracted text sent as context:': 'Extracted text sent as context:',
      'Remove attachment': 'Remove attachment',
      'Sent to the model as an image.': 'Sent to the model as an image.',
      'Too many attachments': 'Too many attachments',
      'Unsupported file type': 'Unsupported file type',
      'truncated': 'truncated',
    })
  })

  it('parses a picked file into an attachment chip', async () => {
    const user = userEvent.setup()
    renderInput()

    const file = new File(['hello from a text file'], 'notes.txt', {
      type: 'text/plain',
    })

    await user.upload(fileInput(), file)

    expect(await screen.findByText('notes.txt')).toBeDefined()
  })

  it('sends the parsed attachment text with the message', async () => {
    const user = userEvent.setup()
    const onSubmit = renderInput()

    await user.upload(
      fileInput(),
      new File(['extracted body text'], 'notes.txt', { type: 'text/plain' })
    )
    await screen.findByText('notes.txt')

    await user.type(screen.getByPlaceholderText('Ask anything'), 'summarise')
    await user.click(submitButton())

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })

    const [text, attachments] = onSubmit.mock.calls[0]

    expect(text).toBe('summarise')
    expect(attachments).toHaveLength(1)
    expect(attachments[0].text).toContain('extracted body text')
  })

  it('submits an attachment-only message', async () => {
    // The composer allows sending with no typed text, so the attachment alone
    // must be enough to trigger a request.
    const user = userEvent.setup()
    const onSubmit = renderInput()

    await user.upload(
      fileInput(),
      new File(['attachment only'], 'only.txt', { type: 'text/plain' })
    )
    await screen.findByText('only.txt')

    await user.click(submitButton())

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })

    const [, attachments] = onSubmit.mock.calls[0]

    expect(attachments).toHaveLength(1)
  })

  it('removes a chip when its remove button is clicked', async () => {
    const user = userEvent.setup()
    renderInput()

    await user.upload(
      fileInput(),
      new File(['body'], 'removable.txt', { type: 'text/plain' })
    )
    await screen.findByText('removable.txt')

    await user.click(
      screen.getByRole('button', { name: 'Remove attachment' })
    )

    await waitFor(() => {
      expect(screen.queryByText('removable.txt')).toBeNull()
    })
  })

  it('clears the chips after a successful submit', async () => {
    const user = userEvent.setup()
    renderInput()

    await user.upload(
      fileInput(),
      new File(['body'], 'once.txt', { type: 'text/plain' })
    )
    await screen.findByText('once.txt')
    await user.click(submitButton())

    await waitFor(() => {
      expect(screen.queryByText('once.txt')).toBeNull()
    })
  })
})
