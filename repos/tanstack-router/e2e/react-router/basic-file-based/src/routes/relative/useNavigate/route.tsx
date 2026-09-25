import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/relative/useNavigate')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  useEffect(() => {
    console.log('navigate')
  }, [navigate])

  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-useNavigate-header">
        Relative Routing - Links - Index
      </div>
      <div>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: '..',
            })
          }
          data-testid="relative-useNavigate-home"
          className="mr-2 underline"
        >
          Return To Home
        </button>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: '.',
            })
          }
          data-testid="relative-useNavigate-index"
          className="mr-2 underline"
        >
          Return To Index
        </button>
        <button
          onClick={() =>
            navigate({
              to: '.',
            })
          }
          data-testid="relative-useNavigate-reload"
          className="mr-2 underline"
        >
          Reload
        </button>
        <button
          onClick={() =>
            navigate({
              to: '..',
            })
          }
          data-testid="relative-useNavigate-back"
          className="mr-2 underline"
        >
          Back
        </button>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: './relative-useNavigate-a',
            })
          }
          data-testid="relative-useNavigate-a"
          className="mr-2 underline"
        >
          To Relative useNavigate A
        </button>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: './relative-useNavigate-b',
            })
          }
          data-testid="relative-useNavigate-b"
          className="mr-2 underline"
        >
          To Relative Link B
        </button>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: './nested/deep',
            })
          }
          data-testid="relative-useNavigate-deeply-nested"
          className="mr-2 underline"
        >
          To Deeply Nested
        </button>
        <button
          onClick={() =>
            navigate({
              to: '/relative/useNavigate/path/$path',
              params: { path: 'a' },
            })
          }
          data-testid="relative-useNavigate-path"
          className="mr-2 underline"
        >
          To Path Param A
        </button>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate',
              to: './with-search',
              search: { searchParam: '1' },
            })
          }
          data-testid="relative-useNavigate-withSearch"
          className="mr-2 underline"
        >
          To With Search Params
        </button>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
