import * as React from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { importedComponent as ImportedComponent } from '../../shared/imported'

export function loaderFn() {
  return { foo: 'bar' }
}

function Layout() {
  return (
    <main>
      <header style={{ height: HEADER_HEIGHT }}>
        <nav>
          <ul>
            <li>
              <a href="/">Home</a>
            </li>
          </ul>
        </nav>
      </header>
      <ImportedComponent />
      <Outlet />
    </main>
  )
}

export const Route = createFileRoute('/_layout')({
  component: Layout,
  loader: loaderFn,
})

const HEADER_HEIGHT = '63px'
export const SIDEBAR_WIDTH = '150px'
export const SIDEBAR_MINI_WIDTH = '80px'
const ASIDE_WIDTH = '250px'
