import { createRenderEffect } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { normalizeParam, smallHash } from '../../../shared'

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f/$g/$h')({
  params: {
    parse: (params) => ({ ...params, h: normalizeParam(params.h) }),
    stringify: (params) => ({ ...params, h: String(params.h) }),
  },
  beforeLoad: ({ params }) => ({ ctxH: smallHash(params.h) }),
  component: LevelH,
})

function ParamsSubscriberOne() {
  const value = Route.useParams({ select: (params) => smallHash(params.h) })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ParamsSubscriberTwo() {
  const value = Route.useParams({
    select: (params) => smallHash(`${params.h}:2`),
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberOne() {
  const value = Route.useRouteContext({ select: (context) => context.ctxH })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function ContextSubscriberTwo() {
  const value = Route.useRouteContext({
    select: (context) => (context.ctxH * 31 + 7) >>> 0,
  })
  createRenderEffect(() => {
    void value()
  })
  return null
}

function LevelH() {
  const params = Route.useParams()
  return (
    <>
      <ParamsSubscriberOne />
      <ParamsSubscriberTwo />
      <ContextSubscriberOne />
      <ContextSubscriberTwo />
      <div data-testid="leaf-state">
        {[
          params().a,
          params().b,
          params().c,
          params().d,
          params().e,
          params().f,
          params().g,
          params().h,
        ].join('.')}
      </div>
    </>
  )
}
