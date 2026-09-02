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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ConsoleModeSwitcher } from '@/components/layout/components/console-mode-switcher'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { useConsoleModeStore } from '@/stores/console-mode-store'

function ModeHarness() {
  const sidebar = useSidebarData()
  const urls = sidebar.navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.url ? [item.url] : (item.items?.map((entry) => entry.url) ?? [])
    )
  )

  return (
    <div data-testid='console-shell'>
      <ConsoleModeSwitcher />
      <nav aria-label='Mode navigation'>
        {urls.map((url) => (
          <a href={url} key={url}>
            {url}
          </a>
        ))}
      </nav>
    </div>
  )
}

describe('mode selection replay', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useConsoleModeStore.getState().setMode('easy')
  })

  it('keeps one stable shell and one copy of every destination', () => {
    render(<ModeHarness />)
    const easy = screen.getByRole('button', { name: 'Easy mode' })
    const developer = screen.getByRole('button', { name: 'Developer mode' })

    fireEvent.click(easy)
    fireEvent.click(easy)
    fireEvent.click(developer)
    fireEvent.click(developer)

    expect(screen.getAllByTestId('console-shell')).toHaveLength(1)
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(developer).toHaveAttribute('aria-pressed', 'true')
  })
})
