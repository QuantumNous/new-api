import { createRenderEffect } from 'solid-js'
import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c')({
  params: {
    parse: (params) => ({ ...params, c: normalizeParam(params.c) }),
    stringify: (params) => ({ ...params, c: String(params.c) }),
  },
  beforeLoad: ({ params }) => ({ ctxC: smallHash(params.c) }),
  component: LevelC,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.c) })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.c}:2`),
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxC })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxC * 31 + 7) >>> 0,
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function LevelC() {
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
