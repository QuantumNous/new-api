import { createRenderEffect } from 'solid-js'
import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f/$g')({
  params: {
    parse: (params) => ({ ...params, g: normalizeParam(params.g) }),
    stringify: (params) => ({ ...params, g: String(params.g) }),
  },
  beforeLoad: ({ params }) => ({ ctxG: smallHash(params.g) }),
  component: LevelG,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.g) })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.g}:2`),
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxG })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxG * 31 + 7) >>> 0,
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function LevelG() {
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
