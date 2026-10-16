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
import { afterEach, expect, test, vi } from 'vitest'

import { GlobeHero } from '../globe-hero'

vi.mock('@/hooks/use-status', () => ({ useStatus: () => ({ status: {} }) }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
afterEach(() => vi.unstubAllGlobals())

test('pauses an offscreen scene, resumes it and releases the observer on unmount', () => {
  let notify: IntersectionObserverCallback = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    }
  )
  const { unmount } = render(<GlobeHero />)
  const frame = screen.getByTitle('AI models') as HTMLIFrameElement
  const frameWindow = frame.contentWindow
  if (!frameWindow) throw new Error('Missing iframe window')
  const post = vi.spyOn(frameWindow, 'postMessage')
  notify(
    [{ isIntersecting: false } as IntersectionObserverEntry],
    {} as IntersectionObserver
  )
  expect(post).toHaveBeenCalledWith(
    { type: 'home-globe-visibility', visible: false },
    '*'
  )
  fireEvent.load(frame)
  expect(post).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'home-globe-copy',
      copy: expect.objectContaining({
        categoryLabel: expect.objectContaining({ chat: 'Chat' }),
      }),
    }),
    '*'
  )
  expect(post).toHaveBeenCalledWith(
    { type: 'home-globe-visibility', visible: false },
    '*'
  )
  notify(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver
  )
  expect(post).toHaveBeenCalledWith(
    { type: 'home-globe-visibility', visible: true },
    '*'
  )
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})

test('fills the dynamic viewport without fixed height limits', () => {
  render(<GlobeHero />)
  const frame = screen.getByTitle('AI models')
  expect(frame).toHaveClass('h-dvh')
  expect(frame).not.toHaveClass('max-h-[1000px]', 'min-h-[420px]', 'h-svh')
})

test('keeps the scene in an isolated document without trapping keyboard focus', () => {
  render(<GlobeHero />)
  const frame = screen.getByTitle('AI models')
  expect(frame).toHaveAttribute('src', '/home-globe/globe.html')
  expect(frame).toHaveAttribute('tabindex', '-1')
})

test('pauses a sticky globe when the content layer covers it and resumes when revealed', () => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  render(
    <section>
      <GlobeHero />
      <div data-home-overlay />
    </section>
  )
  const frame = screen.getByTitle('AI models') as HTMLIFrameElement
  const frameWindow = frame.contentWindow
  if (!frameWindow) throw new Error('Missing iframe window')
  const post = vi.spyOn(frameWindow, 'postMessage')
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 800,
  } as DOMRect)
  const overlay = document.querySelector('[data-home-overlay]')
  if (!overlay) throw new Error('Missing overlay')
  const bounds = vi.spyOn(overlay, 'getBoundingClientRect')
  bounds.mockReturnValue({ top: -10 } as DOMRect)
  fireEvent.scroll(window)
  expect(post).toHaveBeenLastCalledWith(
    { type: 'home-globe-visibility', visible: false },
    '*'
  )
  bounds.mockReturnValue({ top: 300 } as DOMRect)
  fireEvent.scroll(window)
  expect(post).toHaveBeenLastCalledWith(
    { type: 'home-globe-visibility', visible: true },
    '*'
  )
})
