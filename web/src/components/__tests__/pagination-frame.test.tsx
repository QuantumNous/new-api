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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'

import { PaginationFrame } from '../pagination-frame'
import { Button } from '../ui/button'

const data = [1, 2]

function Fixture(props: {
  data: readonly number[]
  onPageChange?: () => void
  onPointerDown?: () => void
}) {
  const [page, setPage] = useState(0)
  return (
    <div data-testid='scroll-container' style={{ overflowY: 'auto' }}>
      <PaginationFrame
        resetKey={props.data}
        pageIndex={page}
        pagination={
          <Button
            onPointerDown={props.onPointerDown}
            onClick={() => {
              setPage(1)
              props.onPageChange?.()
            }}
          >
            Next
          </Button>
        }
      >
        <p>Page {page}</p>
        <Button onClick={props.onPageChange}>Choose plan</Button>
      </PaginationFrame>
    </div>
  )
}

it.each(['mouse', '{Enter}', ' '] as const)(
  'preserves the scroll container position during %s paging without retaining blank space',
  async (interaction) => {
    const user = userEvent.setup()
    render(
      <Fixture
        data={data}
        onPointerDown={() => {
          scroll.scrollTop = 100
        }}
        onPageChange={() => {
          scroll.scrollTop = 50
        }}
      />
    )
    const scroll = screen.getByTestId('scroll-container')
    Object.defineProperties(scroll, {
      clientHeight: { value: 400 },
      scrollHeight: { value: 1400 },
    })
    scroll.scrollTop = 700
    const next = screen.getByRole('button', { name: 'Next' })
    if (interaction === 'mouse') {
      await user.click(next)
    } else {
      next.focus()
      await user.keyboard(interaction)
    }
    expect(screen.getByText('Page 1')).toBeVisible()
    expect(scroll.scrollTop).toBe(700)
    expect(
      scroll.querySelector<HTMLElement>(
        '[data-slot="pagination-frame-content"]'
      )?.style.minHeight
    ).toBe('')
  }
)

it('fits a short final page without keeping the outgoing page height', async () => {
  const user = userEvent.setup()
  render(
    <Fixture
      data={data}
      onPageChange={() => {
        scroll.scrollTop = 0
      }}
    />
  )
  const scroll = screen.getByTestId('scroll-container')
  Object.defineProperties(scroll, {
    clientHeight: { value: 400 },
    scrollHeight: { get: () => (screen.queryByText('Page 0') ? 1400 : 700) },
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 375,
    bottom: 900,
    width: 375,
    height: 900,
    toJSON: () => ({}),
  })
  scroll.scrollTop = 900
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(scroll.scrollTop).toBe(300)
  expect(
    scroll.querySelector<HTMLElement>('[data-slot="pagination-frame-content"]')
      ?.style.minHeight
  ).toBe('')
})

it('does not restore an old scroll position when clicking a content action or refreshing data', async () => {
  const user = userEvent.setup()
  const action = () => {
    scroll.scrollTop = 50
  }
  const { rerender } = render(<Fixture data={data} onPageChange={action} />)
  const scroll = screen.getByTestId('scroll-container')
  Object.defineProperties(scroll, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 1400 },
  })
  scroll.scrollTop = 700
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: 'Choose plan' }))
  expect(scroll.scrollTop).toBe(50)
  rerender(<Fixture data={[3]} onPageChange={action} />)
  expect(scroll.scrollTop).toBe(50)
})
