import { useNavigate, createFileRoute } from '@tanstack/solid-router'
import * as v from 'valibot'
import { Suspense } from 'solid-js'
import { Header } from '../../components/Header'
import { Users, usersQueryOptions } from '../../components/Users'
import { Content } from '../../components/Content'
import { Search } from '../../components/Search'

const Valibot = () => {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <>
      <Header title="Valibot" />
      <Content>
        <Search
          search={search().search}
          onChange={(search) => navigate({ search: { search }, replace: true })}
        />
        <Suspense>
          <Users search={search().search} />
        </Suspense>
      </Content>
    </>
  )
}

export const Route = createFileRoute('/users/valibot/')({
  validateSearch: v.object({
    search: v.fallback(v.optional(v.string(), ''), ''),
  }),
  loaderDeps: (opt) => ({ search: opt.search }),
  loader: (opt) => {
    opt.context.queryClient.ensureQueryData(
      usersQueryOptions(opt.deps.search.search),
    )
  },
  component: Valibot,
})
