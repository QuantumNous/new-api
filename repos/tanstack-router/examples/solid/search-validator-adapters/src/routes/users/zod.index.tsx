import { useNavigate, createFileRoute } from '@tanstack/solid-router'
import { fallback, zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { Suspense } from 'solid-js'
import { Header } from '../../components/Header'
import { Users, usersQueryOptions } from '../../components/Users'
import { Content } from '../../components/Content'
import { Search } from '../../components/Search'

const fallbackString = fallback as unknown as (
  schema: z.ZodString,
  fallback: string,
) => z.ZodType<string, z.ZodTypeDef, string>

const Zod = () => {
  const search = Route.useSearch({
    select: (search) => search.search ?? '',
  })
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <>
      <Header title="Zod" />
      <Content>
        <Search
          search={search()}
          onChange={(search) => navigate({ search: { search }, replace: true })}
        />
        <Suspense>
          <Users search={search()} />
        </Suspense>
      </Content>
    </>
  )
}

export const Route = createFileRoute('/users/zod/')({
  validateSearch: zodValidator(
    z.object({
      search: fallbackString(z.string(), '').default(''),
    }),
  ),
  loaderDeps: (opt) => ({ search: opt.search }),
  loader: (opt) => {
    opt.context.queryClient.ensureQueryData(
      usersQueryOptions(opt.deps.search.search ?? ''),
    )
  },
  component: Zod,
})
