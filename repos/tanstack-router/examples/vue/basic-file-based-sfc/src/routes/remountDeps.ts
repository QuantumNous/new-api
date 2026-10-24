import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/remountDeps')({
  validateSearch(search: { searchParam: string }) {
    return { searchParam: search.searchParam }
  },
  loaderDeps(opts) {
    return opts.search
  },
  remountDeps(opts) {
    return opts.search
  },
})
