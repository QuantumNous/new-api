import { describe, expect, it } from 'vitest'

import { escapeHtml } from '@/utils/html'

describe('escapeHtml', () => {
  it('escapes every character with HTML syntax significance', () => {
    expect(escapeHtml(`<script data-x="'">&`)).toBe(
      '&lt;script data-x=&quot;&#39;&quot;&gt;&amp;'
    )
  })

  it('normalizes non-string tooltip values before escaping them', () => {
    expect(escapeHtml(42)).toBe('42')
    expect(escapeHtml(null)).toBe('null')
  })
})
