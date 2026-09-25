import { Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/대한민국')({
  component: UnicodeComponent,
})

function UnicodeComponent() {
  return (
    <div>
      <h3 class="pb-2" data-testid="unicode-heading">
        Hello "/대한민국"!
      </h3>
      <hr />
      <Outlet />
    </div>
  )
}
