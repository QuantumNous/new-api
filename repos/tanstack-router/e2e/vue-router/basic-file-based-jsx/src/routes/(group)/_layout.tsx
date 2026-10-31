import { Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/(group)/_layout')({
  component: GroupLayoutComponent,
})

function GroupLayoutComponent() {
  return (
    <div>
      <div>Layout inside group</div>
      <Outlet />
    </div>
  )
}
