import { describe, expect, it } from 'vitest'

import { safeExternalUrl, safeImageUrl } from '@/utils/safeUrl'

describe('safe URL helpers', () => {
  it('allows same-origin URLs and explicitly trusted external origins', () => {
    expect(safeExternalUrl('/docs')).toBe('http://localhost:3000/docs')
    expect(safeExternalUrl('https://docs.example.com/guide')).toBeNull()
    expect(
      safeExternalUrl('https://docs.example.com/guide', [
        'https://docs.example.com',
      ])
    ).toBe('https://docs.example.com/guide')
  })

  it('applies the same origin policy to images and blob URLs', () => {
    expect(safeImageUrl('https://images.example.com/cover.webp')).toBeNull()
    expect(
      safeImageUrl('https://images.example.com/cover.webp', [
        'https://images.example.com/gallery',
      ])
    ).toBe('https://images.example.com/cover.webp')
    expect(safeImageUrl('blob:https://images.example.com/asset')).toBeNull()
    expect(safeImageUrl('blob:http://localhost:3000/asset')).toBe(
      'blob:http://localhost:3000/asset'
    )
  })

  it('rejects executable and malformed protocols', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,hello')).toBeNull()
  })

  it('accepts raster data images and only allows inert SVG placeholders', () => {
    expect(safeImageUrl('data:image/png;base64,aGVsbG8=')).toContain(
      'image/png'
    )
    const safeSvg =
      'data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect%20width=%221%22%20height=%221%22%20fill=%22%23fff%22/%3E%3C/svg%3E'
    expect(safeImageUrl(safeSvg)).toBe(safeSvg)
    const gradientSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="1" height="1" fill="url(#g)"/><polyline points="0,1 1,0" fill="none" stroke="#fff" stroke-width="1"/></svg>'
    )}`
    expect(safeImageUrl(gradientSvg)).toBe(gradientSvg)
    expect(safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull()
    expect(
      safeImageUrl(
        'data:image/svg+xml;utf8,%3Csvg%3E%3Cscript%3Ealert(1)%3C/script%3E%3C/svg%3E'
      )
    ).toBeNull()
  })
})
