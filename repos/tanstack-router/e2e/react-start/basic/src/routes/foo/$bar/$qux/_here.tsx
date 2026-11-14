import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/foo/$bar/$qux/_here')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div className="p-2">
      <div className="border-b">I'm a deeper layout with parameters</div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
