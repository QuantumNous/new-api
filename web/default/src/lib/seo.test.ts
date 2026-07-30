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
  formatSeoTitle,
  isPrivateSeoPath,
  resolveRouteSeo,
} from './seo'

describe('formatSeoTitle', () => {
  it('joins page and site name', () => {
    expect(formatSeoTitle('Pricing', 'BoxAI')).toBe('Pricing | BoxAI')
  })

  it('returns site name alone for home', () => {
    expect(formatSeoTitle('BoxAI', 'BoxAI')).toBe('BoxAI')
    expect(formatSeoTitle('', 'BoxAI')).toBe('BoxAI')
  })
})

describe('isPrivateSeoPath', () => {
  it('marks console and auth routes private', () => {
    expect(isPrivateSeoPath('/console')).toBe(true)
    expect(isPrivateSeoPath('/console/token')).toBe(true)
    expect(isPrivateSeoPath('/sign-in')).toBe(true)
    expect(isPrivateSeoPath('/playground/')).toBe(true)
  })

  it('keeps marketing routes public', () => {
    expect(isPrivateSeoPath('/')).toBe(false)
    expect(isPrivateSeoPath('/pricing')).toBe(false)
    expect(isPrivateSeoPath('/docs/getting-started')).toBe(false)
  })
})

describe('resolveRouteSeo', () => {
  it('resolves pricing and private defaults', () => {
    const pricing = resolveRouteSeo('/pricing/', 'BoxAI')
    expect(pricing.title).toBe('Model Pricing')
    expect(pricing.noindex).toBeFalsy()

    const consoleSeo = resolveRouteSeo('/console/log', 'BoxAI')
    expect(consoleSeo.noindex).toBe(true)
  })

  it('builds model detail titles', () => {
    const seo = resolveRouteSeo('/pricing/gpt-4o', 'BoxAI')
    expect(seo.title).toContain('gpt-4o')
  })
})
