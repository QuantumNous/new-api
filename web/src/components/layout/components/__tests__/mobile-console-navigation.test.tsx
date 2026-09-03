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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useConsoleModeStore } from '@/stores/console-mode-store'

import { ConsoleModeControl } from '../console-mode-switcher'
import { EasyTaskDock } from '../easy-task-dock'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: ComponentProps<'a'> & { to: string }) => {
    const { to, ...anchorProps } = props
    return <a {...anchorProps} href={to} />
  },
}))

function setViewport(width: number) {
  const originalMatchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...originalMatchMedia(query),
    matches: query === '(max-width: 767px)' && width < 768,
  }))
}

describe('compact console navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useConsoleModeStore.getState().setMode('easy')
  })

  it.each([320, 390, 767])(
    'replaces the six inline links with a keyboard-accessible menu at %i px',
    async (width) => {
      setViewport(width)
      render(<EasyTaskDock />)
      expect(screen.queryAllByRole('link')).toHaveLength(0)
      const trigger = screen.getByRole('button', {
        name: 'Toggle navigation menu',
      })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })

      expect(
        await screen.findByRole('menuitem', { name: 'Overview' })
      ).toHaveAttribute('href', '/dashboard')
      expect(screen.getByRole('menuitem', { name: 'My key' })).toHaveAttribute(
        'href',
        '/keys'
      )
      expect(
        screen.getByRole('menuitem', { name: 'Model prices' })
      ).toHaveAttribute('href', '/pricing')
      expect(
        screen.getByRole('menuitem', { name: 'Beginner guide' })
      ).toHaveAttribute('href', '/guide')
      expect(
        screen.getByRole('menuitem', { name: 'Spending details' })
      ).toHaveAttribute('href', '/usage-logs')
      expect(screen.getByRole('menuitem', { name: 'Wallet' })).toHaveAttribute(
        'href',
        '/wallet'
      )
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
      await waitFor(() =>
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
      )
      await waitFor(() => expect(trigger).toHaveFocus())
    }
  )

  it('keeps all six named inline links on desktop', () => {
    setViewport(1280)
    render(<EasyTaskDock />)
    expect(
      screen.queryByRole('button', { name: 'Toggle navigation menu' })
    ).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(6)
    expect(screen.getByRole('link', { name: 'My key' })).toBeVisible()
  })

  it('uses one full-size mobile mode button while keeping both mode choices available', async () => {
    setViewport(390)
    render(<ConsoleModeControl compact />)
    const trigger = screen.getByRole('button', { name: 'Mode' })
    expect(screen.queryByRole('button', { name: 'Developer mode' })).toBeNull()
    expect(trigger).toHaveClass('size-10', 'shrink-0')
    fireEvent.click(trigger)
    expect(
      await screen.findByRole('menuitemradio', { name: 'Easy mode' })
    ).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Developer mode' })
    )
    expect(useConsoleModeStore.getState().mode).toBe('developer')
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    )
  })
})
