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
import { describe, expect, it } from 'vitest'

import {
  buildIQPreviewDocument,
  IQ_PREVIEW_CSP,
  IQ_PREVIEW_SANDBOX,
} from '../preview-document'

// Browser capability enforcement is deliberately left to the single integration
// smoke check. jsdom verifies construction, not a sandbox/CPU security claim.
describe('IQ active preview construction', () => {
  it('puts trusted policy first, strips hostile document nodes and keeps inline Canvas/SVG', () => {
    const result = buildIQPreviewDocument(
      `<html><head><base href="https://bad.invalid"><meta http-equiv="refresh" content="0;url=https://bad.invalid"><meta http-equiv="Content-Security-Policy" content="default-src *"><link rel="stylesheet" href="https://bad.invalid/style"></head><body style="background: black"><canvas id="art"></canvas><script>document.getElementById('art').getContext('2d').fillRect(0,0,10,10)</script><script src="https://bad.invalid/script"></script><svg viewBox="0 0 10 10"><circle r="4"/><animate attributeName="r" values="2;4;2" dur="1s" repeatCount="indefinite"/></svg><img src="https://bad.invalid/pixel"><iframe src="https://bad.invalid/frame"></iframe><form action="https://bad.invalid"><input></form><template><meta http-equiv="refresh" content="0"></template></body></html>`
    )
    expect(result.indexOf(IQ_PREVIEW_CSP)).toBeLessThan(
      result.indexOf('<canvas')
    )
    const parsed = new DOMParser().parseFromString(result, 'text/html')
    expect(parsed.querySelectorAll('meta[http-equiv]')).toHaveLength(1)
    expect(parsed.querySelector('base,link,iframe,form,script[src]')).toBeNull()
    expect(parsed.querySelector('img')?.hasAttribute('src')).toBe(false)
    expect(parsed.body.style.background).toBe('black')
    expect(parsed.querySelector('script')?.textContent).toContain(
      "getContext('2d')"
    )
    expect(parsed.querySelector('svg animate')).not.toBeNull()
    expect(IQ_PREVIEW_SANDBOX).toBe('allow-scripts')
  })

  it('keeps a self-contained SVG and rejects oversized artifacts before parsing', () => {
    const result = buildIQPreviewDocument(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA=="/><use href="#drawing"/></svg>'
    )
    expect(result).toContain('data:image/png;base64,AA==')
    expect(result).toContain('href="#drawing"')
    expect(() => buildIQPreviewDocument('x'.repeat(1024 * 1024 + 1))).toThrow(
      'too large'
    )
  })
})
