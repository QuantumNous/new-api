import { describe, expect, it } from 'vitest'
import {
  DownloadSkillError,
  extractDownloadError,
  filenameFromContentDisposition,
  isSafeDownloadUrl,
  sanitizeFilename,
} from './download-utils'

// jsdom sets window.location.origin to http://localhost.

describe('isSafeDownloadUrl', () => {
  it('rejects empty / non-string', () => {
    expect(isSafeDownloadUrl('')).toBe(false)
    // @ts-expect-error testing runtime guard against non-string
    expect(isSafeDownloadUrl(undefined)).toBe(false)
  })

  it('rejects cross-origin even if path looks like the download endpoint', () => {
    expect(
      isSafeDownloadUrl(
        'https://evil.example.com/api/v1/marketplace/skills/x/download'
      )
    ).toBe(false)
  })

  it('rejects protocol-relative //host URLs', () => {
    expect(
      isSafeDownloadUrl('//evil.example.com/marketplace/skills/x/download')
    ).toBe(false)
  })

  it('rejects same-origin paths that are not the download endpoint', () => {
    expect(isSafeDownloadUrl('/settings')).toBe(false)
    expect(isSafeDownloadUrl('/api/v1/marketplace/skills/x')).toBe(false)
  })

  it('accepts the same-origin marketplace download path', () => {
    expect(
      isSafeDownloadUrl('/api/v1/marketplace/skills/my-skill/download')
    ).toBe(true)
  })
})

describe('sanitizeFilename', () => {
  it('strips path separators from the name', () => {
    expect(sanitizeFilename('a/b\\c.zip', 'slug')).toBe('abc.zip')
  })

  it('strips surrounding quotes', () => {
    expect(sanitizeFilename('"x.zip"', 'slug')).toBe('x.zip')
  })

  it('falls back to <slug>.zip when name is empty', () => {
    expect(sanitizeFilename(undefined, 'my-skill')).toBe('my-skill.zip')
    expect(sanitizeFilename('', 'my-skill')).toBe('my-skill.zip')
  })

  it('sanitizes the fallback slug too', () => {
    expect(sanitizeFilename(undefined, 'a/b')).toBe('ab.zip')
  })

  it('uses "skill" when the fallback is empty', () => {
    expect(sanitizeFilename(undefined, '')).toBe('skill.zip')
  })
})

describe('filenameFromContentDisposition', () => {
  it('prefers RFC 5987 filename*= and decodes it', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''%E4%B8%AD.zip",
        'slug'
      )
    ).toBe('中.zip')
  })

  it('falls back to filename=', () => {
    expect(
      filenameFromContentDisposition('attachment; filename=foo.zip', 'slug')
    ).toBe('foo.zip')
  })

  it('falls back to <slug>.zip when header is missing', () => {
    expect(filenameFromContentDisposition(undefined, 'bar')).toBe('bar.zip')
  })
})

describe('extractDownloadError', () => {
  it('parses a Blob JSON envelope', async () => {
    const blob = new Blob(
      [JSON.stringify({ error: { code: 'SKILL_PLAN_REQUIRED', message: 'm' } })],
      { type: 'application/json' }
    )
    const err = await extractDownloadError(blob)
    expect(err).toBeInstanceOf(DownloadSkillError)
    expect(err.code).toBe('SKILL_PLAN_REQUIRED')
    expect(err.message).toBe('m')
  })

  it('parses a string JSON envelope', async () => {
    const err = await extractDownloadError(
      JSON.stringify({ error: { code: 'AUTH_REQUIRED' } })
    )
    expect(err.code).toBe('AUTH_REQUIRED')
  })

  it('parses an already-object envelope', async () => {
    const err = await extractDownloadError({
      error: { code: 'DOWNLOAD_UNAVAILABLE' },
    })
    expect(err.code).toBe('DOWNLOAD_UNAVAILABLE')
  })

  it('falls back to DOWNLOAD_FAILED for HTML / non-JSON bodies', async () => {
    const html = await extractDownloadError(
      new Blob(['<html><body>502 Bad Gateway</body></html>'], {
        type: 'text/html',
      })
    )
    expect(html.code).toBe('DOWNLOAD_FAILED')

    const garbage = await extractDownloadError('not json at all')
    expect(garbage.code).toBe('DOWNLOAD_FAILED')
  })
})
