/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

import { BackToTopButton } from '../back-to-top-button'
import { SectionPageLayout } from '../section-page-layout'

beforeEach(() => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...media,
    media: query,
    matches: false,
  }))
})

function BackToTopFixture(props: {
  backToTop?: boolean
  fixedContent?: boolean
}) {
  return (
    <SectionPageLayout
      backToTop={props.backToTop}
      fixedContent={props.fixedContent}
    >
      <SectionPageLayout.Title>Settings</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div>Settings content</div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function getScrollContainer() {
  const scrollContainer = screen.getByText('Settings content').parentElement
  if (!scrollContainer) throw new Error('Scroll container was not rendered')
  return scrollContainer
}

test('keeps the button outside keyboard navigation until scrolling past 240px', async () => {
  const user = userEvent.setup()
  render(<BackToTopFixture backToTop />)

  const scrollContainer = getScrollContainer()
  const button = screen.getByLabelText('Back to top')

  expect(
    screen.queryByRole('button', { name: 'Back to top' })
  ).not.toBeInTheDocument()
  await user.tab()
  expect(button).not.toHaveFocus()

  scrollContainer.scrollTop = 240
  fireEvent.scroll(scrollContainer)
  expect(
    screen.queryByRole('button', { name: 'Back to top' })
  ).not.toBeInTheDocument()

  scrollContainer.scrollTop = 241
  fireEvent.scroll(scrollContainer)
  expect(button).toHaveAttribute('data-visible', 'true')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Back to top' })).toHaveFocus()

  scrollContainer.scrollTop = 240
  fireEvent.scroll(scrollContainer)
  expect(button).toHaveAttribute('data-visible', 'false')
  expect(button).toHaveAttribute('tabindex', '-1')
})

test.each(['click', 'Enter', 'Space'])(
  '%s returns only the layout container to the top',
  async (activation) => {
    const user = userEvent.setup()
    render(<BackToTopFixture backToTop />)
    const scrollContainer = getScrollContainer()
    const scrollTo = vi.fn()
    scrollContainer.scrollTo = scrollTo
    const windowScrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {})
    scrollContainer.scrollTop = 500
    fireEvent.scroll(scrollContainer)

    const button = screen.getByRole('button', { name: 'Back to top' })
    if (activation === 'click') {
      await user.click(button)
    } else {
      await user.tab()
      expect(button).toHaveFocus()
      await user.keyboard(activation === 'Enter' ? '{Enter}' : ' ')
    }

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(windowScrollTo).not.toHaveBeenCalled()
  }
)

test.each([
  { backToTop: false, fixedContent: false },
  { backToTop: true, fixedContent: true },
])('does not offer back-to-top when layout options are %j', (options) => {
  render(<BackToTopFixture {...options} />)
  const scrollContainer = getScrollContainer()
  scrollContainer.scrollTop = 500
  fireEvent.scroll(scrollContainer)
  expect(screen.queryByLabelText('Back to top')).not.toBeInTheDocument()
})

test('initializes from restored scrolling when a container becomes available', () => {
  const view = render(<BackToTopButton scrollContainer={null} />)
  expect(
    screen.queryByRole('button', { name: 'Back to top' })
  ).not.toBeInTheDocument()
  const scrollContainer = document.createElement('div')
  scrollContainer.scrollTop = 500

  view.rerender(<BackToTopButton scrollContainer={scrollContainer} />)

  expect(screen.getByRole('button', { name: 'Back to top' })).toHaveAttribute(
    'data-visible',
    'true'
  )
})

test('ignores a detached container and follows the replacement container', async () => {
  const user = userEvent.setup()
  const first = document.createElement('div')
  first.scrollTop = 500
  const second = document.createElement('div')
  const scrollTo = vi.fn()
  second.scrollTo = scrollTo
  const view = render(<BackToTopButton scrollContainer={first} />)
  expect(
    screen.getByRole('button', { name: 'Back to top' })
  ).toBeInTheDocument()

  view.rerender(<BackToTopButton scrollContainer={second} />)
  fireEvent.scroll(first)
  expect(
    screen.queryByRole('button', { name: 'Back to top' })
  ).not.toBeInTheDocument()
  second.scrollTop = 500
  fireEvent.scroll(second)
  await user.click(screen.getByRole('button', { name: 'Back to top' }))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

  view.rerender(<BackToTopButton scrollContainer={null} />)
  fireEvent.scroll(second)
  expect(
    screen.queryByRole('button', { name: 'Back to top' })
  ).not.toBeInTheDocument()
})

test('returns instantly when the user prefers reduced motion', async () => {
  const user = userEvent.setup()
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(window, 'matchMedia').mockReturnValue({ ...media, matches: true })
  render(<BackToTopFixture backToTop />)
  const scrollContainer = getScrollContainer()
  const scrollTo = vi.fn()
  scrollContainer.scrollTo = scrollTo
  scrollContainer.scrollTop = 500
  fireEvent.scroll(scrollContainer)

  await user.click(screen.getByRole('button', { name: 'Back to top' }))

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})
