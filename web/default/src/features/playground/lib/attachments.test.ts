import { describe, expect, spyOn, test } from 'bun:test'
import type { FileUIPart } from 'ai'
import {
  MAX_FILE_BYTES,
  normalizePlaygroundAttachments,
} from './attachments'

function textDataUrl(text: string): string {
  return `data:text/plain;base64,${Buffer.from(text, 'utf8').toString('base64')}`
}

function videoDataUrl(): string {
  return 'data:video/mp4;base64,AA=='
}

function file(
  filename: string,
  mediaType: string,
  url: string
): FileUIPart {
  return { type: 'file', filename, mediaType, url }
}

describe('normalizePlaygroundAttachments', () => {
  test('normalizes image data URLs and supported text files', async () => {
    const result = await normalizePlaygroundAttachments([
      file('photo.png', 'image/png', 'data:image/png;base64,AA=='),
      file('notes.md', 'text/markdown', textDataUrl('# Notes')),
    ])

    expect(result).toEqual([
      {
        kind: 'image',
        filename: 'photo.png',
        mediaType: 'image/png',
        url: 'data:image/png;base64,AA==',
      },
      {
        kind: 'text',
        filename: 'notes.md',
        mediaType: 'text/markdown',
        text: '# Notes',
      },
    ])
  })

  test('normalizes supported mp4 attachments as video files', async () => {
    await expect(
      normalizePlaygroundAttachments([
        file('reference.mp4', 'video/mp4', videoDataUrl()),
      ])
    ).resolves.toEqual([
      {
        kind: 'video',
        filename: 'reference.mp4',
        mediaType: 'video/mp4',
        url: videoDataUrl(),
      },
    ])
  })

  test('rejects unsupported extensions and empty files', async () => {
    await expect(
      normalizePlaygroundAttachments([
        file('archive.pdf', 'application/pdf', textDataUrl('x')),
      ])
    ).rejects.toThrow('Unsupported attachment type')

    await expect(
      normalizePlaygroundAttachments([
        file('empty.txt', 'text/plain', textDataUrl('')),
      ])
    ).rejects.toThrow('Attachment is empty')
  })

  test('limits the number of attachments', async () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      file(`file-${index}.txt`, 'text/plain', textDataUrl('x'))
    )

    await expect(normalizePlaygroundAttachments(files)).rejects.toThrow(
      'Too many attachments'
    )
  })

  test('rejects oversized data before decoding the base64 payload', async () => {
    const atobSpy = spyOn(globalThis, 'atob')
    const encoded = 'A'.repeat(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 4)

    await expect(
      normalizePlaygroundAttachments([
        file(
          'large.png',
          'image/png',
          `data:image/png;base64,${encoded}`
        ),
      ])
    ).rejects.toThrow('Attachment exceeds the maximum size')
    expect(atobSpy).not.toHaveBeenCalled()
    atobSpy.mockRestore()
  })
})
