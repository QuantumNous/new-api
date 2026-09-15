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
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticatedLayout } from '@/components/layout/components/authenticated-layout'
import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeCustomizationProvider } from '@/context/theme-customization-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { AccessAuthLayout } from '@/features/auth/access-auth-layout'
import { DesktopClientPage } from '@/features/desktop-client'
import { CatalogPageLayout } from '@/features/pricing/components/catalog-page-layout'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

import { CiLandingPage } from '../ci-landing-page'

let client: QueryClient
let finePointer: boolean
let reducedMotion: boolean
let mediaListeners: Set<EventListenerOrEventListenerObject>
let frames: Map<number, FrameRequestCallback>
let frameId: number
const originalAuth = useAuthStore.getState()
const originalMode = useConsoleModeStore.getState().mode

beforeEach(() => {
  finePointer = true
  reducedMotion = false
  mediaListeners = new Set()
  frames = new Map()
  frameId = 0
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {})
  client.setQueryData(['notice'], { success: true, data: '' })
  useAuthStore.getState().auth.reset()
  useConsoleModeStore.getState().setMode('easy')
  const originalMatchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    const media = originalMatchMedia(query)
    Object.defineProperty(media, 'matches', {
      get: () =>
        query.includes('prefers-reduced-motion') ? reducedMotion : finePointer,
    })
    vi.spyOn(media, 'addEventListener').mockImplementation(
      (_event, listener) => {
        // Motion keeps a shared application listener; track only the
        // cursor's own capability subscriptions for the cleanup contract.
        if (
          query === '(hover: hover) and (pointer: fine)' ||
          query === '(prefers-reduced-motion: reduce)'
        ) {
          mediaListeners.add(listener)
        }
      }
    )
    vi.spyOn(media, 'removeEventListener').mockImplementation(
      (_event, listener) => {
        mediaListeners.delete(listener)
      }
    )
    return media
  })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(originalAuth)
  useConsoleModeStore.getState().setMode(originalMode)
})

async function renderHome() {
  return renderApp(
    <CiLandingPage isAuthenticated={false} models={[]} maxSavingsPercent={0} />,
    client
  )
}

function moveMouse(target: Element, pointerType = 'mouse') {
  const event = new MouseEvent('pointermove', {
    clientX: 320,
    clientY: 180,
    bubbles: true,
  })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  fireEvent(target, event)
}

function drawFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  act(() => {
    for (const callback of callbacks) callback(16)
  })
}

describe('home glass cursor', () => {
  it('follows mouse movement as a decoration and stops painting once settled', async () => {
    await renderHome()
    const cursor = screen.getByTestId('glass-cursor')
    expect(cursor).not.toBeVisible()
    moveMouse(screen.getByRole('main'))
    drawFrame()
    expect(cursor).toBeVisible()
    expect(cursor).toHaveAttribute('aria-hidden', 'true')
    expect(cursor.style.transform).toBe('translate3d(320px, 180px, 0)')
    expect(frames.size).toBe(0)
  })

  it('hides during text entry and keyboard navigation', async () => {
    await renderHome()
    const root = screen.getByRole('main')
    const cursor = screen.getByTestId('glass-cursor')
    moveMouse(root)
    drawFrame()
    moveMouse(
      screen.getByRole('textbox', { name: 'Search models or providers' })
    )
    expect(cursor).not.toBeVisible()
    moveMouse(root)
    drawFrame()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(cursor).not.toBeVisible()
    expect(frames.size).toBe(0)
  })

  it.each(['touch', 'coarse', 'reduced motion'])(
    'does not show the effect for %s',
    async (mode) => {
      finePointer = mode !== 'coarse'
      reducedMotion = mode === 'reduced motion'
      await renderHome()
      moveMouse(screen.getByRole('main'), mode === 'touch' ? 'touch' : 'mouse')
      drawFrame()
      expect(screen.getByTestId('glass-cursor')).not.toBeVisible()
      expect(frames.size).toBe(0)
    }
  )

  it('stops immediately when reduced motion is enabled and releases resources on unmount', async () => {
    const rendered = await renderHome()
    const root = screen.getByRole('main')
    moveMouse(root)
    reducedMotion = true
    act(() => {
      mediaListeners.forEach((listener) => {
        const event = new Event('change')
        if (typeof listener === 'function') listener(event)
        else listener.handleEvent(event)
      })
    })
    expect(screen.getByTestId('glass-cursor')).not.toBeVisible()
    expect(frames.size).toBe(0)
    rendered.unmount()
    moveMouse(document.body)
    expect(screen.queryByTestId('glass-cursor')).toBeNull()
    expect(frames.size).toBe(0)
    expect(mediaListeners.size).toBe(0)
  })
})

describe('glass cursor on related public surfaces', () => {
  it('follows interactive controls on the desktop client page', async () => {
    const rendered = await renderApp(
      <ThemeProvider>
        <FontProvider>
          <DirectionProvider>
            <ThemeCustomizationProvider>
              <DesktopClientPage
                runtime={{
                  hostname: 'example.com',
                  environment: {
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    platform: 'Win32',
                    maxTouchPoints: 0,
                  },
                }}
              />
            </ThemeCustomizationProvider>
          </DirectionProvider>
        </FontProvider>
      </ThemeProvider>,
      client
    )

    const download = screen.getByRole('link', { name: 'Download for Windows' })
    moveMouse(download)
    drawFrame()
    const cursor = screen.getByTestId('glass-cursor')
    expect(cursor).toBeVisible()
    expect(cursor).toHaveAttribute('data-interactive', 'true')

    moveMouse(document.body)
    expect(cursor).not.toBeVisible()
    rendered.unmount()
    expect(screen.queryByTestId('glass-cursor')).not.toBeInTheDocument()
  })

  it('follows explicitly enabled modal surfaces portalled outside the page', async () => {
    await renderApp(
      <AccessAuthLayout title='Sign in'>
        {createPortal(
          <section data-glass-cursor-surface>
            <button type='button'>Model details</button>
          </section>,
          document.body
        )}
      </AccessAuthLayout>,
      client
    )
    moveMouse(screen.getByRole('button', { name: 'Model details' }))
    drawFrame()
    expect(screen.getByTestId('glass-cursor')).toBeVisible()
  })
  it.each(['login', 'catalog', 'authenticated catalog', 'developer catalog'])(
    'follows the mouse on %s, avoids inputs and cleans up on leave',
    async (surface) => {
      if (
        surface === 'authenticated catalog' ||
        surface === 'developer catalog'
      ) {
        useAuthStore.getState().auth.setBundle(createTestAuthBundle())
      }
      if (surface === 'developer catalog') {
        useConsoleModeStore.getState().setMode('developer')
      }
      const content = (
        <>
          <button type='button'>Explore models</button>
          <label>
            Example input
            <input />
          </label>
        </>
      )
      const page =
        surface === 'login' ? (
          <AccessAuthLayout title='Sign in'>{content}</AccessAuthLayout>
        ) : (
          <CatalogPageLayout showMainContainer={false}>
            {content}
          </CatalogPageLayout>
        )
      const rendered = await renderApp(
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <ThemeCustomizationProvider>{page}</ThemeCustomizationProvider>
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>,
        client
      )
      const cursors = screen.getAllByTestId('glass-cursor')
      expect(cursors).toHaveLength(1)
      const cursor = cursors[0]
      moveMouse(screen.getByRole('button', { name: 'Explore models' }))
      drawFrame()
      expect(cursor).toBeVisible()
      expect(cursor).toHaveAttribute('data-interactive', 'true')
      moveMouse(screen.getByRole('textbox', { name: 'Example input' }))
      expect(cursor).not.toBeVisible()
      moveMouse(document.body)
      expect(cursor).not.toBeVisible()
      rendered.unmount()
      expect(screen.queryByTestId('glass-cursor')).not.toBeInTheDocument()
      expect(mediaListeners.size).toBe(0)
    }
  )
})

describe('glass cursor in the authenticated console', () => {
  it('stays active as one shared instance throughout the easy-mode shell', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    useConsoleModeStore.getState().setMode('easy')

    await renderApp(
      <ThemeProvider>
        <FontProvider>
          <DirectionProvider>
            <ThemeCustomizationProvider>
              <AuthenticatedLayout>
                <button type='button'>Open report</button>
              </AuthenticatedLayout>
            </ThemeCustomizationProvider>
          </DirectionProvider>
        </FontProvider>
      </ThemeProvider>,
      client
    )

    const button = screen.getByRole('button', { name: 'Open report' })
    moveMouse(button)
    drawFrame()

    const cursors = screen.getAllByTestId('glass-cursor')
    expect(cursors).toHaveLength(1)
    expect(cursors[0]).toBeVisible()
    expect(cursors[0]).toHaveAttribute('data-interactive', 'true')
  })

  it('does not expand the effect to the generic developer shell', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    useConsoleModeStore.getState().setMode('developer')

    await renderApp(
      <ThemeProvider>
        <FontProvider>
          <DirectionProvider>
            <ThemeCustomizationProvider>
              <AuthenticatedLayout>
                <button type='button'>Open report</button>
              </AuthenticatedLayout>
            </ThemeCustomizationProvider>
          </DirectionProvider>
        </FontProvider>
      </ThemeProvider>,
      client
    )

    moveMouse(screen.getByRole('button', { name: 'Open report' }))
    drawFrame()

    expect(screen.queryByTestId('glass-cursor')).not.toBeInTheDocument()
  })
})
