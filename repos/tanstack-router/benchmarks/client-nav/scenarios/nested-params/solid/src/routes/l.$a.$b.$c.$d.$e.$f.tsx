import { createRenderEffect } from 'solid-js'
import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f')({
  params: {
    parse: (params) => ({ ...params, f: normalizeParam(params.f) }),
    stringify: (params) => ({ ...params, f: String(params.f) }),
  },
  beforeLoad: ({ params }) => ({ ctxF: smallHash(params.f) }),
  component: LevelF,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.f) })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.f}:2`),
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxF })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxF * 31 + 7) >>> 0,
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function LevelF() {
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
