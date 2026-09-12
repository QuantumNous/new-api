import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import type {
  TransformAssets,
  TransformAssetsFn,
} from '@tanstack/react-start/server'

type CreateTransformContext =
  | { warmup: true }
  | { request: Request; warmup: false }

const cdnOrigin = 'https://cdn.example.com'

const createCdnTransform = (prefix: string): TransformAssetsFn => {
  return ({ url }) => `${prefix}${url}`
}

const transformAssets: TransformAssets = {
  createTransform: (ctx: CreateTransformContext) => {
    const prefix = ctx.warmup
      ? cdnOrigin
      : (ctx.request.headers.get('x-assets-cdn') ?? cdnOrigin)

    return createCdnTransform(prefix)
  },
  cache: false,
}

const handler = createStartHandler({
  handler: defaultStreamHandler,
  inlineCss: true,
  transformAssets,
})

export default createServerEntry({
  fetch(request) {
    return handler(request, {
      inlineCss: request.headers.get('x-inline-css') !== 'false',
      responseLinkHeader: true,
    })
  },
})
