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
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { CHANNEL_PRIORITY_GUIDE_KEYS } from '../../constants'
import { ChannelPriorityModeToggle } from '../channel-priority-controls'

function Fixture(props: { reason?: 'sort'; viewMode?: 'card' | 'table' }) {
  const [active, setActive] = useState(false)
  return (
    <ChannelPriorityModeToggle
      active={active}
      viewMode={props.viewMode ?? 'table'}
      reason={props.reason ?? null}
      onChange={() => setActive((value) => !value)}
    />
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

test('drag mode and its help are presented as one accessible control group', () => {
  render(<Fixture />)
  const group = within(screen.getByRole('group', { name: 'Drag mode' }))
  expect(group.getByRole('button', { name: 'Drag mode' })).toBeVisible()
  expect(group.getByRole('button', { name: 'Drag mode help' })).toBeVisible()
})

test('seeing the table guide does not hide the first card guide', async () => {
  localStorage.setItem(CHANNEL_PRIORITY_GUIDE_KEYS.table, 'seen')
  const user = userEvent.setup()
  const page = render(<Fixture viewMode='card' />)
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  const guide = within(await screen.findByRole('dialog'))
  expect(guide.getByRole('list', { name: 'Card view' })).toBeVisible()
  await user.click(guide.getByRole('button', { name: 'Got it' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  page.unmount()
  render(<Fixture viewMode='card' />)
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('first activation shows the guide and remembers dismissal across visits', async () => {
  const user = userEvent.setup()
  const page = render(
    <StrictMode>
      <Fixture />
    </StrictMode>
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  const guide = await screen.findByRole('dialog', {
    name: 'Drag to set channel priority',
  })
  expect(within(guide).getByText('Join the same priority tier')).toBeVisible()
  expect(within(guide).getByText('Insert a new priority tier')).toBeVisible()
  await user.click(within(guide).getByRole('button', { name: 'Got it' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(localStorage.getItem(CHANNEL_PRIORITY_GUIDE_KEYS.table)).toBe('seen')
  expect(
    screen.getByRole('button', { name: 'Finish reordering' })
  ).toHaveAttribute('aria-pressed', 'true')
  page.unmount()
  render(<Fixture />)
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('returning users can reopen the demo and Escape returns focus to help', async () => {
  localStorage.setItem(CHANNEL_PRIORITY_GUIDE_KEYS.table, 'seen')
  const user = userEvent.setup()
  render(<Fixture />)
  const help = screen.getByRole('button', { name: 'Drag mode help' })
  help.focus()
  await user.keyboard('{Enter}')
  expect(
    await screen.findByRole('dialog', { name: 'Drag to set channel priority' })
  ).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  await waitFor(() => expect(help).toHaveFocus())
  expect(screen.getByRole('button', { name: 'Drag mode' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})

test('an unavailable drag mode keeps help accessible without enabling reordering', async () => {
  const user = userEvent.setup()
  render(<Fixture reason='sort' />)
  expect(screen.getByRole('button', { name: 'Drag mode' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Drag mode help' }))
  await user.click(screen.getByRole('button', { name: 'Got it' }))
  expect(screen.getByRole('button', { name: 'Drag mode' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Drag mode' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})

test('unavailable browser storage does not block the guide or repeat it within the visit', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Unavailable')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Unavailable')
  })
  const user = userEvent.setup()
  render(<Fixture />)
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  await user.click(screen.getByRole('button', { name: 'Got it' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  await user.click(screen.getByRole('button', { name: 'Finish reordering' }))
  await user.click(screen.getByRole('button', { name: 'Drag mode' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test.each(['table', 'card'] as const)(
  '%s guide automatically plays both distinct demos and loops after showing each result',
  (viewMode) => {
    const original = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...original(query),
      matches: false,
    }))
    vi.useFakeTimers()
    render(<Fixture viewMode={viewMode} />)
    fireEvent.click(screen.getByRole('button', { name: 'Drag mode' }))
    const guide = within(screen.getByRole('dialog'))
    const joinTab = guide.getByRole('tab', {
      name: 'Join the same priority tier',
    })
    const insertTab = guide.getByRole('tab', {
      name: 'Insert a new priority tier',
    })
    expect(joinTab).toHaveAttribute('aria-selected', 'true')
    expect(
      guide.getByRole('list', {
        name: viewMode === 'card' ? 'Card view' : 'Table view',
      })
    ).toBeVisible()
    act(() => vi.advanceTimersByTime(1600))
    expect(guide.getByRole('status')).toHaveTextContent(
      'Release to join priority 80'
    )
    act(() => vi.advanceTimersByTime(1400))
    expect(guide.getByRole('status')).toHaveTextContent('New priority: 80')
    act(() => vi.advanceTimersByTime(2199))
    expect(joinTab).toHaveAttribute('aria-selected', 'true')
    expect(guide.getByRole('status')).toHaveTextContent('New priority: 80')
    act(() => vi.advanceTimersByTime(1))
    expect(insertTab).toHaveAttribute('aria-selected', 'true')
    expect(guide.getByRole('status')).toHaveTextContent(
      'Drag the handle to move a channel.'
    )
    expect(guide.getByText('Channel C').closest('li')).toHaveTextContent(
      'Priority 0'
    )
    act(() => vi.advanceTimersByTime(1600))
    expect(guide.getByRole('status')).toHaveTextContent(
      'Release to insert a new priority tier'
    )
    if (viewMode === 'table') {
      expect(
        guide.getAllByRole('listitem').map((row) => row.textContent)
      ).toEqual([
        'Channel APriority 100',
        'Channel BPriority 80',
        'Channel CPriority 90',
      ])
    }
    act(() => vi.advanceTimersByTime(1400))
    expect(guide.getByRole('status')).toHaveTextContent('New priority: 90')
    expect(
      guide.getAllByRole('listitem').map((row) => row.textContent)
    ).toEqual([
      'Channel APriority 100',
      'Channel CPriority 90',
      'Channel BPriority 80',
    ])
    act(() => vi.advanceTimersByTime(2200))
    expect(joinTab).toHaveAttribute('aria-selected', 'true')
    expect(guide.getByText('Channel C').closest('li')).toHaveTextContent(
      'Priority 0'
    )
    fireEvent.click(guide.getByRole('button', { name: 'Got it' }))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Drag mode help' }))
    const reopened = within(screen.getByRole('dialog'))
    expect(
      reopened.getByRole('tab', { name: 'Join the same priority tier' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(reopened.getByText('Channel C').closest('li')).toHaveTextContent(
      'Priority 0'
    )
  }
)

test('autoplay can pause, resume from the same point, and replay the complete sequence', () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: false,
  }))
  vi.useFakeTimers()
  render(<Fixture />)
  fireEvent.click(screen.getByRole('button', { name: 'Drag mode help' }))
  const guide = within(screen.getByRole('dialog'))
  act(() => vi.advanceTimersByTime(1600))
  fireEvent.click(guide.getByRole('button', { name: 'Pause drag demo' }))
  act(() => vi.advanceTimersByTime(15000))
  expect(guide.getByRole('status')).toHaveTextContent(
    'Release to join priority 80'
  )
  fireEvent.click(guide.getByRole('button', { name: 'Resume drag demo' }))
  act(() => vi.advanceTimersByTime(1399))
  expect(guide.getByRole('status')).toHaveTextContent(
    'Release to join priority 80'
  )
  act(() => vi.advanceTimersByTime(1))
  expect(guide.getByRole('status')).toHaveTextContent('New priority: 80')
  act(() => vi.advanceTimersByTime(2200))
  expect(
    guide.getByRole('tab', { name: 'Insert a new priority tier' })
  ).toHaveAttribute('aria-selected', 'true')
  act(() => vi.advanceTimersByTime(1600))
  fireEvent.click(guide.getByRole('button', { name: 'Replay drag demo' }))
  expect(
    guide.getByRole('tab', { name: 'Join the same priority tier' })
  ).toHaveAttribute('aria-selected', 'true')
  expect(guide.getByText('Channel C').closest('li')).toHaveTextContent(
    'Priority 0'
  )
  act(() => vi.advanceTimersByTime(5200))
  expect(
    guide.getByRole('tab', { name: 'Insert a new priority tier' })
  ).toHaveAttribute('aria-selected', 'true')
})

test('manually selecting a demo starts its own complete playback without an old automatic switch', () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: false,
  }))
  vi.useFakeTimers()
  render(<Fixture />)
  fireEvent.click(screen.getByRole('button', { name: 'Drag mode help' }))
  const guide = within(screen.getByRole('dialog'))
  const insertTab = guide.getByRole('tab', {
    name: 'Insert a new priority tier',
  })
  act(() => vi.advanceTimersByTime(4800))
  fireEvent.click(insertTab)
  act(() => vi.advanceTimersByTime(400))
  expect(insertTab).toHaveAttribute('aria-selected', 'true')
  expect(guide.getByRole('status')).toHaveTextContent(
    'Drag the handle to move a channel.'
  )
  act(() => vi.advanceTimersByTime(1200))
  expect(guide.getByRole('status')).toHaveTextContent(
    'Release to insert a new priority tier'
  )
  act(() => vi.advanceTimersByTime(3600))
  expect(
    guide.getByRole('tab', { name: 'Join the same priority tier' })
  ).toHaveAttribute('aria-selected', 'true')
})

test('reduced motion shows the result of the selected demo immediately', async () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query === '(prefers-reduced-motion: reduce)',
  }))
  render(<Fixture />)
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Drag mode help' }))
  const guide = within(await screen.findByRole('dialog'))
  expect(guide.getByRole('status')).toHaveTextContent('New priority: 80')
  expect(guide.getByText('Channel C').closest('li')).toHaveTextContent(
    'Priority 80'
  )
  await userEvent
    .setup()
    .click(guide.getByRole('tab', { name: 'Insert a new priority tier' }))
  expect(guide.getByRole('status')).toHaveTextContent('New priority: 90')
  expect(guide.getByText('Channel C').closest('li')).toHaveTextContent(
    'Priority 90'
  )
})

test('keyboard selection switches to the other explicitly named demo', async () => {
  const user = userEvent.setup()
  render(<Fixture />)
  await user.click(screen.getByRole('button', { name: 'Drag mode help' }))
  const guide = within(await screen.findByRole('dialog'))
  guide.getByRole('tab', { name: 'Join the same priority tier' }).focus()
  await user.keyboard('{ArrowRight}')
  expect(
    guide.getByRole('tab', { name: 'Insert a new priority tier' })
  ).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(
    guide.getByRole('tab', { name: 'Insert a new priority tier' })
  ).toHaveAttribute('aria-selected', 'true')
  expect(guide.getByRole('status')).toHaveTextContent('New priority: 90')
})
