import { joinPaths, trimPath } from './path'
import type { LocationRewrite } from './router'

/** Compose multiple rewrite pairs into a single in/out rewrite. */
export function composeRewrites(rewrites: Array<LocationRewrite>) {
  return {
    input: ({ url }) => {
      for (const rewrite of rewrites) {
        url = executeRewriteInput(rewrite, url)
      }
      return url
    },
    output: ({ url }) => {
      for (let i = rewrites.length - 1; i >= 0; i--) {
        url = executeRewriteOutput(rewrites[i], url)
      }
      return url
    },
  } satisfies LocationRewrite
}

/** Create a rewrite pair that strips/adds a basepath on input/output. */
export function rewriteBasepath(opts: {
  basepath: string
  caseSensitive?: boolean
}) {
  const trimmedBasepath = trimPath(opts.basepath)
  const normalizedBasepath = `/${trimmedBasepath}`
  const checkBasepath = opts.caseSensitive
    ? normalizedBasepath
    : normalizedBasepath.toLowerCase()
  const checkBasepathWithSlash = `${checkBasepath}/`

  return {
    input: ({ url }) => {
      const pathname = opts.caseSensitive
        ? url.pathname
        : url.pathname.toLowerCase()

      // Handle exact basepath match (e.g., /my-app -> /)
      if (pathname === checkBasepath) {
        url.pathname = '/'
      } else if (pathname.startsWith(checkBasepathWithSlash)) {
        // Handle basepath with trailing content (e.g., /my-app/users -> /users)
        url.pathname = url.pathname.slice(normalizedBasepath.length)
      }
      return url
    },
    output: ({ url }) => {
      url.pathname = joinPaths(['/', trimmedBasepath, url.pathname])
      return url
    },
  } satisfies LocationRewrite
}

/** Execute a location input rewrite if provided. */
export function executeRewriteInput(
  rewrite: LocationRewrite | undefined,
  url: URL,
): URL {
  const res = rewrite?.input?.({ url })
  if (res) {
    if (typeof res === 'string') {
      return new URL(res)
    } else if (res instanceof URL) {
      return res
    }
  }
  return url
}

/** Execute a location output rewrite if provided. */
export function executeRewriteOutput(
  rewrite: LocationRewrite | undefined,
  url: URL,
): URL {
  const res = rewrite?.output?.({ url })
  if (res) {
    if (typeof res === 'string') {
      return new URL(res)
    } else if (res instanceof URL) {
      return res
    }
  }
  return url
}
