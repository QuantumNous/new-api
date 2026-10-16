import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(test)/duplicate-import')({
  component: PostsLayoutComponent,
})

function PostsLayoutComponent() {
  return (
    <>
      <Link to="/">Home</Link>
      <Outlet />
    </>
  )
}
