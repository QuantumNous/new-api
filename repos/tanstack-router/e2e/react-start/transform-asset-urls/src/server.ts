import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import type {
  TransformAssets,
  TransformAssetsFn,
} from '@tanstack/react-start/server'

const cdnOrigin = process.env.CDN_ORIGIN
const transformMode = process.env.TRANSFORM_ASSETS_MODE || 'string'
const optionsKind =
  process.env.TRANSFORM_ASSETS_OPTIONS_KIND || 'createTransform'
const optionsCache = process.env.TRANSFORM_ASSETS_OPTIONS_CACHE || 'true'
const optionsWarmup = process.env.TRANSFORM_ASSETS_OPTIONS_WARMUP || 'true'

const cache = optionsCache !== 'false'
const warmup = optionsWarmup === 'true'

console.log(
  `[server-entry]: using custom server entry with transformAssets (${transformMode}${transformMode === 'options' ? `:${optionsKind}` : ''})${cdnOrigin ? ` (CDN: ${cdnOrigin})` : ' (no CDN)'}`,
)

const createTransformAssetsFn =
  (cdn: string): TransformAssetsFn =>
  ({ kind, url }) => {
    const href = `${cdn}${url}`

    if (kind === 'script') {
      return {
        href,
        crossOrigin: 'anonymous',
      }
    }

    if (kind === 'stylesheet') {
      return {
        href,
        crossOrigin: 'anonymous',
      }
    }

    return { href }
  }

const createTransformAssetsConfig = (cdn: string): TransformAssets => {
  const transformAssetsFn = createTransformAssetsFn(cdn)

  if (transformMode === 'function') {
    return transformAssetsFn
  }

  if (transformMode === 'options') {
    if (optionsKind === 'transform') {
      return {
        transform: transformAssetsFn,
        cache,
        warmup,
      }
    }

    return {
      createTransform: async () => {
        return transformAssetsFn
      },
      cache,
      warmup,
    }
  }

  return cdn
}

const handler = createStartHandler(
  cdnOrigin
    ? {
        handler: defaultStreamHandler,
        transformAssets: createTransformAssetsConfig(
          cdnOrigin.replace(/\/+$/, ''),
        ),
      }
    : defaultStreamHandler,
)

export default createServerEntry({ fetch: handler })
