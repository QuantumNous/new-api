import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/notRemountDeps')({
  validateSearch(search: { searchParam: string }) {
    return { searchParam: search.searchParam }
  },
  loaderDeps(opts) {
    return opts.search
  },
  remountDeps(opts) {
    return opts.params
  },
})
