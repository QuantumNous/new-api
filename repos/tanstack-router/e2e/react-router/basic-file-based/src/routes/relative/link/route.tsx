import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/relative/link')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  useEffect(() => {
    console.log('navigate')
  }, [navigate])

  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-link-header">
        Relative Routing - Links - Index
      </div>
      <div>
        <Link
          from="/relative/link"
          to=".."
          data-testid="relative-link-home"
          className="mr-2 underline"
        >
          Return To Home
        </Link>
        <Link
          from="/relative/link"
          to="."
          data-testid="relative-link-index"
          className="mr-2"
        >
          Return To Index
        </Link>
        <Link
          to="."
          data-testid="relative-link-reload"
          className="mr-2 underline"
        >
          Reload
        </Link>
        <Link
          to=".."
          data-testid="relative-link-back"
          className="mr-2 underline"
        >
          Back
        </Link>
        <Link
          from="/relative/link"
          to="./relative-link-a"
          data-testid="relative-link-a"
          className="mr-2 underline"
        >
          To Relative Link A
        </Link>
        <Link
          from="/relative/link"
          to="./relative-link-b"
          data-testid="relative-link-b"
          className="mr-2 underline"
        >
          To Relative Link B
        </Link>
        <Link
          from="/relative/link"
          to="./nested/deep"
          data-testid="relative-link-deeply-nested"
          className="mr-2 underline"
        >
          To Deeply Nested
        </Link>
        <Link
          to="/relative/link/path/$path"
          params={{ path: 'a' }}
          data-testid="relative-link-path"
          className="mr-2 underline"
        >
          To Path Param A
        </Link>
        <Link
          from="/relative/link"
          to="./with-search"
          search={{ searchParam: '1' }}
          data-testid="relative-link-withSearch"
          className="mr-2 underline"
        >
          To With Search Params
        </Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
