import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('passes through safe HTML unchanged', () => {
    const safe = '<div><p>Hello <strong>world</strong></p></div>'
    expect(sanitizeHtml(safe)).toBe(safe)
  })

  it('removes script tags', () => {
    const input = '<div>Safe<script>alert("XSS")</script></div>'
    expect(sanitizeHtml(input)).toBe('<div>Safe</div>')
  })

  it('removes iframe tags', () => {
    const input = '<p>Before</p><iframe src="evil.com"></iframe><p>After</p>'
    expect(sanitizeHtml(input)).toBe('<p>Before</p><p>After</p>')
  })

  it('removes object tags', () => {
    const input = '<object data="evil.swf"></object>'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes embed tags', () => {
    const input = '<embed src="evil.swf">'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes form tags', () => {
    const input = '<form action="/evil"><input type="text"></form>'
    // input is removed by DOMParser when form is removed (orphaned input elements are not valid)
    expect(sanitizeHtml(input)).not.toContain('<form')
    expect(sanitizeHtml(input)).not.toContain('action="/evil"')
  })

  it('removes applet tags', () => {
    const input = '<applet code="Evil.class"></applet>'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes base tags', () => {
    const input = '<base href="evil.com">'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes meta tags', () => {
    const input = '<meta http-equiv="refresh" content="0;url=evil.com">'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes link tags', () => {
    const input = '<link rel="stylesheet" href="evil.css">'
    expect(sanitizeHtml(input)).toBe('')
  })

  it('removes onclick event handlers', () => {
    const input = '<div onclick="alert(1)">Click me</div>'
    expect(sanitizeHtml(input)).toBe('<div>Click me</div>')
  })

  it('removes onmouseover event handlers', () => {
    const input = '<span onmouseover="alert(1)">Hover</span>'
    expect(sanitizeHtml(input)).toBe('<span>Hover</span>')
  })

  it('removes onload event handlers', () => {
    const input = '<img onload="alert(1)" src="img.jpg">'
    expect(sanitizeHtml(input)).toBe('<img src="img.jpg">')
  })

  it('removes javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>'
    expect(sanitizeHtml(input)).toBe('<a>Click</a>')
  })

  it('handles mixed case javascript: protocol', () => {
    const input = '<a href="JAVASCRIPT:alert(1)">Click</a>'
    expect(sanitizeHtml(input)).toBe('<a>Click</a>')
  })

  it('preserves safe href attributes', () => {
    const input = '<a href="https://example.com">Link</a>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('handles complex nested HTML', () => {
    const input = '<div><p>Safe content</p><script>alert(\'xss\')</script><a href="javascript:evil()">Bad link</a><a href="https://good.com">Good link</a><img onload="evil()" src="img.jpg"></div>'
    const expected = '<div><p>Safe content</p><a>Bad link</a><a href="https://good.com">Good link</a><img src="img.jpg"></div>'
    expect(sanitizeHtml(input)).toBe(expected)
  })

  it('preserves data attributes', () => {
    const input = '<div data-id="123" data-name="test">Content</div>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves aria attributes', () => {
    const input = '<button aria-label="Close">X</button>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('removes multiple dangerous tags together', () => {
    const input = `
      <script>alert(1)</script>
      <iframe src="evil"></iframe>
      <form action="evil"></form>
      <p>Safe</p>
    `
    expect(sanitizeHtml(input)).toContain('<p>Safe</p>')
    expect(sanitizeHtml(input)).not.toContain('<script')
    expect(sanitizeHtml(input)).not.toContain('<iframe')
    expect(sanitizeHtml(input)).not.toContain('<form')
  })
})
