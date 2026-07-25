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
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlatkeyBrandLogo } from './flatkey-brand-logo'

describe('FlatkeyBrandLogo', () => {
  test('uses the official compact website navigation proportions', () => {
    const markup = renderToStaticMarkup(<FlatkeyBrandLogo />)

    expect(markup).toContain('data-flatkey-brand="lockup"')
    expect(markup).toContain('src="/flatkey-mark.svg"')
    expect(markup).toContain('h-[38px] w-[38px]')
    expect(markup).toContain('min-[901px]:h-9')
    expect(markup).toContain('data-flatkey-wordmark="true"')
    expect(markup).toContain('text-[30px]')
    expect(markup).toContain('min-[901px]:text-[28px]')
    expect(markup).toContain('font-bold')
    expect(markup).toContain('font-family:&#x27;Public Sans&#x27;')
    expect(markup).toContain('letter-spacing:-0.043em')
    expect(markup).not.toContain('flatkey.ai')
  })

  test('allows responsive callers to hide only the wordmark', () => {
    const markup = renderToStaticMarkup(
      <FlatkeyBrandLogo wordmarkClassName='max-[420px]:hidden' />
    )

    expect(markup).toContain('max-[420px]:hidden')
    expect(markup).toContain('h-[38px] w-[38px]')
  })
})
