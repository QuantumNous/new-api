import { useNavigate, createFileRoute } from '@tanstack/solid-router'
import { type } from 'arktype'
import { Suspense } from 'solid-js'
import { Header } from '../../components/Header'
import { Users, usersQueryOptions } from '../../components/Users'
import { Content } from '../../components/Content'
import { Search } from '../../components/Search'

const ArkType = () => {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <>
      <Header title="ArkType" />
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

const search = type({
  search: 'string = ""',
})

export const Route = createFileRoute('/users/arktype/')({
  validateSearch: search,
  loaderDeps: (opt) => ({ search: opt.search }),
  loader: (opt) => {
    opt.context.queryClient.ensureQueryData(
      usersQueryOptions(opt.deps.search.search),
    )
  },
  component: ArkType,
})
