import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import type { TransformAssetsFn } from '@tanstack/react-start/server'

const transformInlineCssAssets =
  process.env.CSS_INLINE_TRANSFORM_ASSETS === 'true'
const transformAssets: TransformAssetsFn = ({ kind, url }) => {
  if (kind === 'css-url') {
    return `${url}${url.includes('?') ? '&' : '?'}cdn=1`
  }

  return url
}

const handler = createStartHandler({
  handler: defaultStreamHandler,
  // The request option below should win over this handler-level default.
  inlineCss: false,
  ...(transformInlineCssAssets
    ? {
        transformAssets,
      }
    : {}),
})

export default createServerEntry({
  fetch(request) {
    return handler(request, {
      inlineCss: request.headers.get('x-inline-css') !== 'false',
    })
  },
})
