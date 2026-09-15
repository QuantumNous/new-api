import { createFileRoute } from '@tanstack/vue-router'
import { RemountDepsComponent } from '../components/RemountDepsComponent'

export const Route = createFileRoute('/remountDeps')({
  validateSearch: (search: Record<string, unknown>) => ({
    searchParam: (search.searchParam as string) || '',
  }),
  loaderDeps(opts) {
    return opts.search
  },
  remountDeps(opts) {
    return opts.search
  },
  component: RemountDepsComponent,
})
