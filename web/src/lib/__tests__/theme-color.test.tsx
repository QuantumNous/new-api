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
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveThemeColor, useThemeColor } from '../theme-color'

// jsdom does not resolve var() in computed styles, so stand in for the CSS
// cascade: the dark class lives on <html> and the preset attribute on <body>,
// as in theme.css and theme-presets.css.
function cascadedForeground(): string {
  if (document.body.getAttribute('data-theme-preset') === 'rose-garden') {
    return 'rgb(80, 20, 40)'
  }
  return document.documentElement.classList.contains('dark')
    ? 'rgb(245, 245, 245)'
    : 'rgb(10, 10, 10)'
}

describe('useThemeColor', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ color: cascadedForeground() }) as CSSStyleDeclaration
    )
    // jsdom has no canvas; the computed CSS color is returned as is.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
    document.body.removeAttribute('data-theme-preset')
    vi.restoreAllMocks()
  })

  test('resolves the token for the current theme on mount', () => {
    const { result } = renderHook(() => useThemeColor('--foreground'))

    expect(result.current).toBe('rgb(10, 10, 10)')
  })

  test('re-resolves when the dark class is added to html', async () => {
    const { result } = renderHook(() => useThemeColor('--foreground'))

    await act(async () => {
      document.documentElement.classList.add('dark')
    })

    expect(result.current).toBe('rgb(245, 245, 245)')
  })

  test('re-resolves when the theme preset attribute changes on body', async () => {
    const { result } = renderHook(() => useThemeColor('--foreground'))

    await act(async () => {
      document.body.setAttribute('data-theme-preset', 'rose-garden')
    })

    expect(result.current).toBe('rgb(80, 20, 40)')
  })
})

describe('resolveThemeColor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('converts an oklch token to rgba through a canvas pixel', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      color: 'oklch(0.965 0 0)',
    } as CSSStyleDeclaration)
    // Stand-in for the browser canvas: it accepts any CSS color as fillStyle
    // and reports the painted pixel as sRGB bytes.
    const context = {
      fillStyle: '',
      fillRect: vi.fn(),
      getImageData: () => ({ data: [245, 245, 245, 255] }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    )

    const color = resolveThemeColor('--foreground')

    expect(context.fillStyle).toBe('oklch(0.965 0 0)')
    expect(color).toBe('rgba(245, 245, 245, 1.00)')
  })
})
