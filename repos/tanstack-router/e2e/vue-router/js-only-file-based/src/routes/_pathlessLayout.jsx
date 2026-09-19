import { createFileRoute } from '@tanstack/vue-router'
import { Outlet } from '@tanstack/vue-router'

export const Route = createFileRoute('/_pathlessLayout')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div class="p-2">
      <div class="border-b">I'm a pathless layout</div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
