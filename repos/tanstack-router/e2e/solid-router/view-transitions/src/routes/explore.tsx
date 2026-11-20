import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/explore')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-2 [view-transition-name:main-content]">
      <h3>
        Explore the CSS to see how to use active-view-transition-type to create
        new viewTransitions to use with Tanstack Router.
      </h3>
      <h4 class={'text-sm mt-2 italic'}>
        Disclaimer: View Transition Types may not be supported in all browsers
        and will fall back to the default browser transition if not available.
      </h4>
      <div class="flex justify-center gap-10 mt-4">
        <Link
          to={'/how-it-works'}
          // see styles.css for 'slide-right' transition
          viewTransition={{ types: ['slide-right'] }}
          class="font-bold"
        >
          &lt;- Previous Page
        </Link>
      </div>
    </div>
  )
}
