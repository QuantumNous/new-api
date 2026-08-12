import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { normalizePage, normalizeQuery } from '../../../shared'

const SearchPage = Vue.defineComponent({
  setup() {
    const search = Route.useSearch()

    return () => (
      <p>{`Results for "${search.value.q}" page ${search.value.page}`}</p>
    )
  },
})

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: normalizeQuery(search.q),
    page: normalizePage(search.page),
  }),
  component: SearchPage,
})
