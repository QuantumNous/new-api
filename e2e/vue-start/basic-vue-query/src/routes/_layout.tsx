import { Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/_layout')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div class="p-2">
      <div>I'm a layout</div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
