import { Outlet, createFileRoute, useNavigate } from '@tanstack/solid-router'
import { createEffect } from 'solid-js'

export const Route = createFileRoute('/relative/useNavigate')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  createEffect(() => {
    console.log('navigate')
  })

  return (
    <div class="p-2">
      <div class="border-b" data-testid="relative-useNavigate-header">
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
          class="mr-2 underline"
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
