import { Outlet, createFileRoute } from '@tanstack/react-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e')({
  params: {
    parse: (params) => ({ ...params, e: normalizeParam(params.e) }),
    stringify: (params) => ({ ...params, e: String(params.e) }),
  },
  beforeLoad: ({ params }) => ({ ctxE: smallHash(params.e) }),
  component: LevelE,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.e) })
  void value
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.e}:2`),
  })
  void value
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxE })
  void value
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxE * 31 + 7) >>> 0,
  })
  void value
  return null
}

function LevelE() {
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
