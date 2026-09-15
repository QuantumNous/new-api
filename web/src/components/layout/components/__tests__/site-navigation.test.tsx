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

import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'

import { renderApp } from '@/test-utils/render-app'

import { Header } from '../header'
import { TopNav } from '../top-nav'

afterEach(cleanup)

it('shows site links directly without a dropdown and keeps keyboard and disabled-link behavior', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  await renderApp(
    <TopNav
      variant='inline'
      links={[
        { title: 'Home', href: '/' },
        { title: 'Docs', href: 'https://docs.example.com', external: true },
        { title: 'Disabled page', href: '/about', disabled: true },
      ]}
    />,
    client
  )
  expect(
    screen.getByRole('navigation', { name: 'Main navigation' })
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Site' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Open navigation' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
    'href',
    '/'
  )
  expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
    'target',
    '_blank'
  )
  expect(screen.getByRole('link', { name: 'Disabled page' })).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  screen.getByRole('link', { name: 'Home' }).focus()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Docs' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Disabled page' })).not.toHaveFocus()
  expect(
    screen.getByRole('link', { name: 'Disabled page' })
  ).not.toHaveAttribute('href')
  client.clear()
})

it('reserves a second header row and contains overflow for narrow navigation without changing headers that have no site links', async () => {
  const style = document.createElement('style')
  style.textContent =
    readFileSync('src/styles/dopamine.css', 'utf8') +
    readFileSync('src/styles/operator-theme.css', 'utf8')
  document.head.append(style)
  const client = new QueryClient()
  try {
    await renderApp(
      <>
        <section
          aria-label='Developer shell'
          className='dopa-console dopa-console--developer'
        >
          <Header showSidebarTrigger={false} className='dopa-developer-header'>
            <TopNav
              variant='inline'
              className='dopa-site-nav'
              links={[{ title: 'Home', href: '/' }]}
            />
          </Header>
        </section>
        <section
          aria-label='Other shell'
          className='dopa-console dopa-console--developer'
        />
      </>,
      client
    )
    const shell = screen.getByRole('region', { name: 'Developer shell' })
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      getComputedStyle(shell).getPropertyValue('--app-header-height')
    ).toBe('5.5rem')
    expect(
      getComputedStyle(
        screen.getByRole('region', { name: 'Other shell' })
      ).getPropertyValue('--app-header-height')
    ).toBe('3.25rem')
    expect(getComputedStyle(navigation).overflowX).toBe('auto')
    expect(getComputedStyle(navigation).flexBasis).toBe('100%')
  } finally {
    style.remove()
    client.clear()
  }
})
