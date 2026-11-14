import { createRenderEffect } from 'solid-js'
import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b')({
  params: {
    parse: (params) => ({ ...params, b: normalizeParam(params.b) }),
    stringify: (params) => ({ ...params, b: String(params.b) }),
  },
  beforeLoad: ({ params }) => ({ ctxB: smallHash(params.b) }),
  component: LevelB,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.b) })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.b}:2`),
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxB })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxB * 31 + 7) >>> 0,
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function LevelB() {
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
