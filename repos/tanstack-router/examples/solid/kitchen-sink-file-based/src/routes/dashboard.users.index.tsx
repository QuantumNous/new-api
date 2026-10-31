import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'

export const Route = createFileRoute('/dashboard/users/')({
  component: UsersIndexComponent,
})

function UsersIndexComponent() {
  return (
    <div class="p-2 space-y-2">
      <p>
        Normally, setting default search parameters would either need to be done
        manually in every link to a page, or as a side-effect (not a great
        experience).
      </p>
      <p>
        Instead, we can use <strong>search filters</strong> to provide defaults
        or even persist search params for links to routes (and child routes).
      </p>
      <p>
        A good example of this is the sorting and filtering of the users list.
        In a traditional router, both would be lost while navigating around
        individual users or even changing each sort/filter option unless each
        state was manually passed from the current route into each new link we
        created (that's a lot of tedious and error-prone work). With TanStack
        router and search filters, they are persisted with little effort.
      </p>
    </div>
  )
}
