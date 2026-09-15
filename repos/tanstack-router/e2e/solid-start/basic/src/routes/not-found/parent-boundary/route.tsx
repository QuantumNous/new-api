import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/not-found/parent-boundary')({
  loader: () => ({
    parentLoaderData: 'ready',
  }),
  component: RouteComponent,
  notFoundComponent: ParentBoundaryNotFoundComponent,
})

function RouteComponent() {
  return (
    <div>
      <Outlet />
    </div>
  )
}

function ParentBoundaryNotFoundComponent() {
  const loaderData = Route.useLoaderData()

  return (
    <div data-testid="parent-boundary-notFound-component">
      <div data-testid="parent-loader-data">
        {loaderData().parentLoaderData}
      </div>
    </div>
  )
}
