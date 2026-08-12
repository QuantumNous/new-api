import { MetaProvider } from '@solidjs/meta'
import { For } from 'solid-js'
import { Asset } from './Asset'
import { useTags } from './headContentUtils'
import type { AssetCrossOriginConfig } from '@tanstack/router-core'

export interface HeadContentProps {
  assetCrossOrigin?: AssetCrossOriginConfig
}

/**
 * @description The `HeadContent` component is used to render meta tags, links, and scripts for the current route.
 * When using full document hydration (hydrating from `<html>`), this component should be rendered in the `<body>`
 * to ensure it's part of the reactive tree and updates correctly during client-side navigation.
 * The component uses portals internally to render content into the `<head>` element.
 */
export function HeadContent(props: HeadContentProps) {
  const tags = useTags(props.assetCrossOrigin)

  return (
    <MetaProvider>
      <For each={tags()}>{(tag) => <Asset {...tag} />}</For>
    </MetaProvider>
  )
}
