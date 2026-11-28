import * as Vue from 'vue'
import { createFileRoute, notFound } from '@tanstack/vue-router'

const MissingPage = Vue.defineComponent({
  setup() {
    const data = Route.useLoaderData()
    return () => <div data-testid="missing-state">{data.value.id}</div>
  },
})

const MissingNotFound = Vue.defineComponent({
  setup() {
    return () => <div data-testid="not-found-state">missing not found</div>
  },
})

export const Route = createFileRoute('/missing/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: ({ params }) => {
    if (params.id === 'gone') {
      throw notFound()
    }
    return { id: params.id }
  },
  component: MissingPage,
  notFoundComponent: MissingNotFound,
})
