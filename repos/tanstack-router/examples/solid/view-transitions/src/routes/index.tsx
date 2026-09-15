import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-2 [view-transition-name:main-content]">
      <h3>Welcome To The View Transitions Example!</h3>
      <div class="flex justify-center mt-4">
        <Link
          to={'/how-it-works'}
          // see styles.css for 'slide-left' transition
          viewTransition={{ types: ['slide-left'] }}
          class="font-bold"
        >
          Next Page -&gt;
        </Link>
      </div>
    </div>
  )
}
