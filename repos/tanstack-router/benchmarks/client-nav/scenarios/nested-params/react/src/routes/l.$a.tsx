import { Outlet, createFileRoute } from '@tanstack/react-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a')({
  params: {
    parse: (params) => ({ ...params, a: normalizeParam(params.a) }),
    stringify: (params) => ({ ...params, a: String(params.a) }),
  },
  beforeLoad: ({ params }) => ({ ctxA: smallHash(params.a) }),
  component: LevelA,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.a) })
  void value
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.a}:2`),
  })
  void value
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxA })
  void value
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxA * 31 + 7) >>> 0,
  })
  void value
  return null
}

function LevelA() {
  return (
    <>
      <ParamsSubscriberOne />
      <ParamsSubscriberTwo />
      <ContextSubscriberOne />
      <ContextSubscriberTwo />
      <Outlet />
    </>
  )
}
