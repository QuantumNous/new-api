'use client'

import * as React from 'react'
import { DEV_STYLES_ATTR } from '@tanstack/router-core'
import { Asset } from './Asset'
import { useRouter } from './useRouter'
import { useHydrated } from './ClientOnly'
import { useTags } from './headContentUtils'
import type { HeadContentProps } from './HeadContent'

/**
 * Render route-managed head tags (title, meta, links, styles, head scripts).
 * Place inside the document head of your app shell.
 *
 * Development version: filters out dev styles link after hydration and
 * includes a fallback cleanup effect for hydration mismatch cases.
 *
 * @link https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
 */
export function HeadContent(props: HeadContentProps) {
  const tags = useTags(props.assetCrossOrigin)
  const router = useRouter()
  const nonce = router.options.ssr?.nonce
  const hydrated = useHydrated()

  // Fallback cleanup for hydration mismatch cases
  // Runs when hydration completes to remove any orphaned dev styles links from DOM
  React.useEffect(() => {
    if (hydrated) {
      document
        .querySelectorAll(`link[${DEV_STYLES_ATTR}]`)
        .forEach((el) => el.remove())
    }
  }, [hydrated])

  // Filter out dev styles after hydration
  const filteredTags = hydrated
    ? tags.filter(
        (tag) => tag.tag !== 'link' || tag.attrs?.[DEV_STYLES_ATTR] !== true,
      )
    : tags

  return (
    <>
      {filteredTags.map((tag) => (
        <Asset {...tag} key={`tsr-meta-${JSON.stringify(tag)}`} nonce={nonce} />
      ))}
    </>
  )
}
