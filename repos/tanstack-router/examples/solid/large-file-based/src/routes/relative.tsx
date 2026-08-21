import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative')({
  component: RelativeComponent,
})

function RelativeComponent() {
  return (
    <div class="p-2 space-y-2">
      <Link
        from={Route.fullPath}
        to="../relative"
        class="block py-1 text-blue-800 hover:text-blue-600"
      >
        Relative
      </Link>
    </div>
  )
}
