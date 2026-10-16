import { ConvexProvider } from 'convex-solidjs'
import type { JSXElement } from 'solid-js'
import { convexClient } from '~/library/convex-client'

export default function AppConvexProvider(props: { children: JSXElement }) {
  return <ConvexProvider client={convexClient}>{props.children}</ConvexProvider>
}
