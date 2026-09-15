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

import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { renderApp } from '@/test-utils/render-app'

import { SystemBrand } from '../system-brand'

afterEach(cleanup)

it('makes both system-brand variants accessible links to the public home', async () => {
  const client = new QueryClient()
  client.setQueryData(['status'], {})
  await renderApp(
    <SidebarProvider>
      <SystemBrand variant='inline' />
      <SystemBrand />
    </SidebarProvider>,
    client
  )
  const links = screen.getAllByRole('link', { name: 'Go to home' })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', '/')
  }
  client.clear()
})

it('keeps a full logo boundary when the inline brand shares a narrow header with a fixed action', async () => {
  const style = document.createElement('style')
  style.textContent = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../styles/dopamine.css'
    ),
    'utf8'
  )
  document.head.append(style)
  const client = new QueryClient()
  client.setQueryData(['status'], { system_name: 'A long system name' })

  try {
    await renderApp(
      <div className='dopa-developer-header flex' style={{ width: '52px' }}>
        <SystemBrand variant='inline' />
        <button type='button' style={{ width: '32px', flexShrink: 0 }}>
          Action
        </button>
      </div>,
      client
    )
    const brand = screen.getByRole('link', { name: 'Go to home' })
    const brandStyle = getComputedStyle(brand)

    expect(brandStyle.minInlineSize).toBe('1.25rem')
    expect(brandStyle.maxInlineSize).toBe('100%')
    expect(brandStyle.overflow).toBe('hidden')
    expect(screen.getByRole('img', { name: 'Logo' }).parentElement).toHaveClass(
      'shrink-0'
    )
  } finally {
    style.remove()
    client.clear()
  }
})
