import { createFileRoute } from '@tanstack/vue-router'
import { NotRemountDepsComponent } from '../components/NotRemountDepsComponent'

export const Route = createFileRoute('/notRemountDeps')({
  validateSearch: (search: Record<string, unknown>) => ({
    searchParam: (search.searchParam as string) || '',
  }),
  loaderDeps(opts) {
    return opts.search
  },
  remountDeps(opts) {
    return opts.params
  },
  component: NotRemountDepsComponent,
})
