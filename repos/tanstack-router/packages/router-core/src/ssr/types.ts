import type { Manifest } from '../manifest'
import type { MakeRouteMatch } from '../Matches'

export interface DehydratedMatch {
  i: MakeRouteMatch['id']
  b?: MakeRouteMatch['__beforeLoadContext']
  l?: MakeRouteMatch['loaderData']
  e?: MakeRouteMatch['error']
  u: MakeRouteMatch['updatedAt']
  s: MakeRouteMatch['status']
  ssr?: MakeRouteMatch['ssr']
  g?: true
}

export interface DehydratedRouter {
  manifest: Manifest | undefined
  dehydratedData?: any
  lastMatchId?: string
  matches: Array<DehydratedMatch>
}

export interface TsrSsrGlobal {
  router?: DehydratedRouter
  // Signal that router hydration is complete
  h: () => void
  // Signal that stream has ended
  e: () => void
  // Cleanup all hydration resources and scripts
  c: () => void
  // p: Push script into buffer or execute immediately
  p: (script: () => void) => void
  buffer: Array<() => void>
  // custom transformers, shortened since this is sent for each streamed value that needs a custom transformer
  t?: Map<string, (value: any) => any>
  // this flag indicates whether the transformers were initialized
  initialized?: boolean
  // router is hydrated and doesnt need the streamed values anymore
  hydrated?: boolean
  // stream has ended
  streamEnded?: boolean
}
