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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  AttachmentPreviewDialog,
  MessageAttachmentList,
} from '../attachment-preview'
import type { PlaygroundAttachment } from '../../../types'

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

function imageAttachment(
  overrides: Partial<PlaygroundAttachment> = {}
): PlaygroundAttachment {
  return {
    id: 'img-1',
    filename: 'diagram.png',
    mediaType: 'image/png',
    kind: 'image',
    size: 2048,
    dataUrl: PNG_DATA_URL,
    ...overrides,
  } as PlaygroundAttachment
}

function textAttachment(
  overrides: Partial<PlaygroundAttachment> = {}
): PlaygroundAttachment {
  return {
    id: 'doc-1',
    filename: 'report.pdf',
    mediaType: 'application/pdf',
    kind: 'document',
    size: 4096,
    text: 'extracted pdf body',
    ...overrides,
  } as PlaygroundAttachment
}

describe('AttachmentPreviewDialog', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Click to preview': 'Click to preview',
      'Download': 'Download',
      'Extracted text sent as context:': 'Extracted text sent as context:',
      'No text could be extracted from this file.':
        'No text could be extracted from this file.',
      'Sent to the model as an image.': 'Sent to the model as an image.',
      'This image format cannot be previewed in the browser.':
        'This image format cannot be previewed in the browser.',
      'It is still sent to the model as an image.':
        'It is still sent to the model as an image.',
      'truncated': 'truncated',
    })
  })

  it('opens a dialog showing the full-size image when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog attachment={imageAttachment()}>
        <span>diagram.png</span>
      </AttachmentPreviewDialog>
    )

    // Nothing is mounted until the trigger is activated.
    expect(screen.queryByAltText('diagram.png')).toBeNull()

    await user.click(screen.getByText('diagram.png'))

    // The dialog renders the image itself at full size (the chip icon is 20px).
    const image = await screen.findByAltText('diagram.png')
    expect(image).toBeDefined()
    // Header states what the model receives. The description is assembled from
    // several text nodes, so match on the containing node's text content.
    expect(
      document.body.textContent?.includes('Sent to the model as an image.')
    ).toBe(true)
  })

  it('shows the extracted text for a document attachment', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog attachment={textAttachment()}>
        <span>report.pdf</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('report.pdf'))

    expect(await screen.findByText('extracted pdf body')).toBeDefined()
  })

  it('reports when no text could be extracted', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog
        attachment={textAttachment({ text: '   ', id: 'doc-empty' })}
      >
        <span>empty.pdf</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('empty.pdf'))

    expect(
      await screen.findByText('No text could be extracted from this file.')
    ).toBeDefined()
  })

  it('falls back to a message when the image cannot be previewed', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog
        attachment={imageAttachment({ dataUrl: undefined, id: 'img-no-url' })}
      >
        <span>scan.heic</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('scan.heic'))

    expect(
      await screen.findByText(
        'This image format cannot be previewed in the browser.'
      )
    ).toBeDefined()
    expect(
      screen.getByText('It is still sent to the model as an image.')
    ).toBeDefined()
  })

  it('offers a text download for a document, which carries no data URL', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    render(
      <AttachmentPreviewDialog
        attachment={textAttachment({ dataUrl: undefined })}
      >
        <span>report.pdf</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('report.pdf'))
    await screen.findByText('extracted pdf body')

    // Documents hold extracted text only, so the download must fall back to a
    // .txt built from that text rather than silently disappearing.
    const download = screen.getByText('Download')
    expect(download).toBeDefined()

    await user.click(download)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    vi.unstubAllGlobals()
  })

  it('offers no download when there is neither a data URL nor text', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog
        attachment={textAttachment({ dataUrl: undefined, text: undefined })}
      >
        <span>report.pdf</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('report.pdf'))
    await screen.findByText('No text could be extracted from this file.')

    expect(screen.queryByText('Download')).toBeNull()
  })

  it('marks a truncated attachment in the header', async () => {
    const user = userEvent.setup()
    render(
      <AttachmentPreviewDialog
        attachment={textAttachment({ textTruncated: true })}
      >
        <span>big.pdf</span>
      </AttachmentPreviewDialog>
    )

    await user.click(screen.getByText('big.pdf'))

    expect(await screen.findByText(/truncated/)).toBeDefined()
  })
})

describe('MessageAttachmentList', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Click to preview': 'Click to preview',
      'No text could be extracted from this file.':
        'No text could be extracted from this file.',
      'Sent to the model as an image.': 'Sent to the model as an image.',
    })
  })

  it('renders nothing when the message has no attachments', () => {
    const { container } = render(<MessageAttachmentList attachments={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders a chip per attachment so sent files stay visible', () => {
    render(
      <MessageAttachmentList
        attachments={[imageAttachment(), textAttachment()]}
      />
    )

    expect(screen.getByText('diagram.png')).toBeDefined()
    expect(screen.getByText('report.pdf')).toBeDefined()
  })

  it('opens the preview from a sent message chip', async () => {
    const user = userEvent.setup()
    render(<MessageAttachmentList attachments={[textAttachment()]} />)

    await user.click(screen.getByText('report.pdf'))

    expect(await screen.findByText('extracted pdf body')).toBeDefined()
  })

  it('has no remove control in the read-only message view', () => {
    render(
      <MessageAttachmentList
        attachments={[imageAttachment({ filename: 'only.png' })]}
      />
    )

    // The composer owns removal; a sent message must not offer it.
    const buttons = document.querySelectorAll('button[aria-label*="Remove"]')
    expect(buttons.length).toBe(0)
  })
})
