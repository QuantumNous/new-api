import { afterEach, describe, expect, it } from 'vitest'

import { getCanvasTheme } from '@/canvas/theme'

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

describe('canvas theme', () => {
  it('resolves night structure from semantic CSS tokens', () => {
    const root = document.documentElement
    root.style.setProperty('--page-background', '#111827')
    root.style.setProperty('--surface-container-lowest', '#0f172a')
    root.style.setProperty('--surface-container', '#1f2937')
    root.style.setProperty('--accent', '#facc15')
    root.style.setProperty('--signal', 'rgb(96 165 250)')
    root.style.setProperty('--glow', '#6ee7b7')

    const theme = getCanvasTheme('dark')

    expect(theme.backgroundTop).toBe('#0f172a')
    expect(theme.backgroundBottom).toBe('#111827')
    expect(theme.nodeSurface).toBe('#1f2937')
    expect(theme.mapHighlight).toBe('#facc15')
    expect(theme.mapLand).toBe('#60a5fa')
    expect(theme.mapRipple).toBe('#6ee7b7')
  })

  it('falls back instead of leaking an unsupported colour into canvas math', () => {
    document.documentElement.style.setProperty('--accent', 'not-a-color')

    expect(getCanvasTheme('dark').accent).toBe('#e2bc55')
  })

  it('keeps the protected light canvas palette independent from night tokens', () => {
    document.documentElement.style.setProperty('--accent', '#000000')

    expect(getCanvasTheme('light').accent).toBe('#D8984C')
  })
})
