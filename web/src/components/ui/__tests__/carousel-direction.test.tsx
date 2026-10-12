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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../carousel'
import { DirectionProvider } from '../direction'

// jsdom has no layout observers; Embla only needs them to exist here.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', ObserverStub)
  vi.stubGlobal('ResizeObserver', ObserverStub)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderCarousel(
  direction: 'ltr' | 'rtl',
  setApi?: (api: CarouselApi) => void
) {
  render(
    <DirectionProvider direction={direction}>
      <div dir={direction}>
        <Carousel setApi={setApi}>
          <CarouselContent>
            <CarouselItem>One</CarouselItem>
            <CarouselItem>Two</CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </DirectionProvider>
  )
}

describe('Carousel direction', () => {
  it('places the previous and next buttons on the inline start and end sides', () => {
    renderCarousel('rtl')

    const previous = screen.getByRole('button', { name: 'Previous slide' })
    const next = screen.getByRole('button', { name: 'Next slide' })
    expect(previous).toHaveClass('-start-12')
    expect(previous).not.toHaveClass('-left-12')
    expect(next).toHaveClass('-end-12')
    expect(next).not.toHaveClass('-right-12')
  })

  it('mirrors the arrow icons on a right-to-left page', () => {
    renderCarousel('rtl')

    for (const name of ['Previous slide', 'Next slide']) {
      const icon = screen.getByRole('button', { name }).querySelector('svg')
      expect(icon).toHaveClass('rtl:-scale-x-100')
    }
  })

  it('uses logical gutters between the slides', () => {
    renderCarousel('rtl')

    const slide = screen.getByText('One')
    expect(slide).toHaveClass('ps-4')
    expect(slide).not.toHaveClass('pl-4')
    expect(slide.parentElement).toHaveClass('-ms-4')
    expect(slide.parentElement).not.toHaveClass('-ml-4')
  })

  it('on a right-to-left page, moves to the next slide with the left arrow key', () => {
    let api: CarouselApi
    renderCarousel('rtl', (value) => {
      api = value
    })
    const scrollNext = vi.spyOn(api!, 'scrollNext')
    const scrollPrev = vi.spyOn(api!, 'scrollPrev')

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowLeft' })

    expect(scrollNext).toHaveBeenCalledOnce()
    expect(scrollPrev).not.toHaveBeenCalled()
  })

  it('on a left-to-right page, moves to the next slide with the right arrow key', () => {
    let api: CarouselApi
    renderCarousel('ltr', (value) => {
      api = value
    })
    const scrollNext = vi.spyOn(api!, 'scrollNext')

    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowRight' })

    expect(scrollNext).toHaveBeenCalledOnce()
  })
})
