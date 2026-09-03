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
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, screen } from '@testing-library/react'
import { Wallet } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SidebarMenuButton,
  SidebarMenuSubButton,
  SidebarProvider,
} from '@/components/ui/sidebar'

const sidebarCss = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../styles/dopamine.css'
  ),
  'utf8'
)

// The sidebar tokens are OKLCH; contrast uses linear sRGB luminance.
function sidebarLuminance(color: string): number {
  const components = color.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (!components) throw new Error(`Unexpected sidebar color: ${color}`)
  const lightness = Number(components[1])
  const chroma = Number(components[2])
  const hue = (Number(components[3]) * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((value) => Math.max(0, Math.min(1, value)))
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function SidebarFixture(props: { walletActive?: boolean }) {
  return (
    <SidebarProvider className='dopa-console dopa-console--developer'>
      <SidebarMenuButton
        isActive={props.walletActive ?? true}
        render={<a href='/wallet' />}
      >
        <Wallet aria-hidden data-testid='wallet-icon' />
        <span>Wallet</span>
      </SidebarMenuButton>
      <SidebarMenuButton render={<a href='/keys' />}>
        API keys
      </SidebarMenuButton>
      <SidebarMenuSubButton isActive href='/settings/general'>
        System information
      </SidebarMenuSubButton>
    </SidebarProvider>
  )
}

describe.each(['light', 'dark'])(
  '%s sidebar selected-state contrast',
  (theme) => {
    let stylesheet: HTMLStyleElement
    let originalTheme: string

    beforeEach(() => {
      originalTheme = document.documentElement.className
      document.documentElement.classList.toggle('dark', theme === 'dark')
      stylesheet = document.createElement('style')
      stylesheet.textContent = sidebarCss
      document.head.append(stylesheet)
    })

    afterEach(() => {
      stylesheet.remove()
      document.documentElement.className = originalTheme
    })

    it('applies dark selected text to the real Base UI active attribute for main and nested links', () => {
      render(<SidebarFixture />)
      const wallet = screen.getByRole('link', { name: 'Wallet' })
      const nested = screen.getByRole('link', { name: 'System information' })
      for (const selected of [wallet, nested]) {
        expect(selected).toHaveAttribute('data-active', '')
        expect(getComputedStyle(selected).color).toBe(
          'var(--dopa-sidebar-active-ink)'
        )
      }
      expect(screen.getByTestId('wallet-icon')).toHaveAttribute(
        'stroke',
        'currentColor'
      )
      expect(getComputedStyle(screen.getByTestId('wallet-icon')).color).toBe(
        getComputedStyle(wallet).color
      )
      expect(
        getComputedStyle(screen.getByRole('link', { name: 'API keys' })).color
      ).toBe('var(--dopa-sidebar-ink)')
    })

    it('keeps selected text dark during keyboard focus and restores light text after deselection', () => {
      const { rerender } = render(<SidebarFixture />)
      const wallet = screen.getByRole('link', { name: 'Wallet' })
      wallet.focus()
      expect(wallet).toHaveFocus()
      expect(getComputedStyle(wallet).color).toBe(
        'var(--dopa-sidebar-active-ink)'
      )
      rerender(<SidebarFixture walletActive={false} />)
      expect(wallet).not.toHaveAttribute('data-active')
      expect(getComputedStyle(wallet).color).toBe('var(--dopa-sidebar-ink)')
    })

    it('maintains readable contrast between the selected background and its text token', () => {
      const tokens = getComputedStyle(document.documentElement)
      const foreground = sidebarLuminance(
        tokens.getPropertyValue('--dopa-sidebar-active-ink').trim()
      )
      const background = sidebarLuminance(
        tokens.getPropertyValue('--dopa-sidebar-active').trim()
      )
      const contrast =
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    })
  }
)
