import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/absolute')({
  component: AbsoluteComponent,
})

function AbsoluteComponent() {
  return (
    <div class="p-2 space-y-2">
      <Link to="/absolute" class="block py-1 text-blue-800 hover:text-blue-600">
        Absolute
      </Link>
    </div>
  )
}
