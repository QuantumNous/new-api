import { Outlet, createFileRoute } from '@tanstack/react-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c/$d')({
  params: {
    parse: (params) => ({ ...params, d: normalizeParam(params.d) }),
    stringify: (params) => ({ ...params, d: String(params.d) }),
  },
  beforeLoad: ({ params }) => ({ ctxD: smallHash(params.d) }),
  component: LevelD,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.d) })
  void value
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.d}:2`),
  })
  void value
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxD })
  void value
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxD * 31 + 7) >>> 0,
  })
  void value
  return null
}

function LevelD() {
  const params = Route.useParams()
  return (
    <>
      <ParamsSubscriberOne />
      <ParamsSubscriberTwo />
      <ContextSubscriberOne />
      <ContextSubscriberTwo />
      <div data-testid="mid-state">
        {[params.a, params.b, params.c, params.d].join('.')}
      </div>
      <Outlet />
    </>
  )
}
