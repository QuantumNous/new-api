import { describe, expect, test } from 'bun:test'
import {
  RECALL_EMAIL_ACTIONS,
  RECALL_CONTENT_ONLY_EMAIL_ACTIONS,
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  RECALL_EMAIL_STARTER_HTML,
  convertRecallBodyTextToHtml,
  insertRecallEmailAction,
  normalizeRecallBodyInputToHtml,
} from './email-html'

describe('recall email HTML helpers', () => {
  test('exports the required recall email actions', () => {
    expect(RECALL_EMAIL_ACTIONS).toEqual([
      '{{.RecipientName}}',
      '{{.PromotionCodeMasked}}',
      '{{.ProductSummary}}',
      '{{.ExpiresAt}}',
      '{{.ClaimURL}}',
      '{{.UnsubscribeURL}}',
    ])
  })

  test('exports the content-only action subset', () => {
    expect(RECALL_CONTENT_ONLY_EMAIL_ACTIONS).toEqual([
      '{{.RecipientName}}',
      '{{.UnsubscribeURL}}',
    ])
  })

  test('provides editable starter HTML with required action links', () => {
    expect(RECALL_EMAIL_STARTER_HTML).not.toContain('example.com')
    expect(RECALL_EMAIL_STARTER_HTML).toContain('href="{{.ClaimURL}}"')
    expect(RECALL_EMAIL_STARTER_HTML).toContain('href="{{.UnsubscribeURL}}"')
    expect([...RECALL_EMAIL_STARTER_HTML.matchAll(/\shref="/g)]).toHaveLength(2)
  })

  test('provides editable Flatkey content-only announcement starter HTML', () => {
    const html = RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML

    expect(html).toContain('<table')
    expect(html).toContain('#f5f6f8')
    expect(html).toContain('max-width: 680px')
    expect(html).toContain('padding: 52px')
    expect(html).toContain('font-size: 46px')
    expect(html).toContain('color: #172033')
    expect(html).toContain('font-size: 28px')
    expect(html).toContain('color: #5d687c')
    expect(html).toContain('font-size: 21px')
    expect(html).toContain('line-height: 1.7')
    expect(html).toContain('background: #eef6ff')
    expect(html).toContain('border: 1px solid #c7e2ff')
    expect(html).toContain('background: #0f83ee')
    expect(html).toContain('border-radius: 8px')
    expect(html).toContain('text-align: right')
    expect(html).toContain('Flatkey')
    expect(html).toContain('{{.RecipientName}}')
    expect(html).toContain('href="https://flatkey.com"')
    expect(html).toContain('href="{{.UnsubscribeURL}}"')
    expect(html).not.toContain('{{.ClaimURL}}')
    expect(html).not.toContain('{{.PromotionCodeMasked}}')
    expect(html).not.toContain('{{.ProductSummary}}')
    expect(html).not.toContain('{{.ExpiresAt}}')
    expect(html).not.toContain('CR')
  })

  test('converts legacy text paragraphs into escaped editable HTML', () => {
    const html = convertRecallBodyTextToHtml(
      'Hello\r\nSecond line\r\n\r\n<>&"\''
    )

    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('<p>Second line</p>')
    expect(html).toContain('&lt;&gt;&amp;&quot;&#39;')
    expect(html).toContain('{{.ClaimURL}}')
    expect(html).toContain('{{.UnsubscribeURL}}')
  })

  test('converts plain body input to escaped HTML with required action links', () => {
    const html = normalizeRecallBodyInputToHtml('Hello\n2 < 3 & "quoted"')

    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('<p>2 &lt; 3 &amp; &quot;quoted&quot;</p>')
    expect(html).toContain('href="{{.ClaimURL}}"')
    expect(html).toContain('href="{{.UnsubscribeURL}}"')
  })

  test('preserves real HTML body input for existing backend validation', () => {
    const source =
      '<p>Hello</p><p><a href="{{.ClaimURL}}">Claim</a></p><p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></p>'

    expect(normalizeRecallBodyInputToHtml(source)).toBe(source)
  })

  test('inserts recall actions at normalized selections', () => {
    expect(insertRecallEmailAction('abc', 1, 2, '{{.ClaimURL}}')).toEqual({
      value: 'a{{.ClaimURL}}c',
      selection: 14,
    })
    expect(insertRecallEmailAction('abc', 5, -1, '{{.ClaimURL}}')).toEqual({
      value: '{{.ClaimURL}}',
      selection: 13,
    })
  })
})
