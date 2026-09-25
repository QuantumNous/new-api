import * as React from 'react'
import { useStore } from '@tanstack/react-store'
import {
  appendUniqueUserTags,
  deepEqual,
  escapeHtml,
  getAssetCrossOrigin,
  getScriptPreloadAttrs,
  resolveManifestCssLink,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'
import type {
  AnyRouteMatch,
  AssetCrossOriginConfig,
  RouterManagedTag,
} from '@tanstack/router-core'

function buildTagsFromMatches(
  router: ReturnType<typeof useRouter>,
  nonce: string | undefined,
  matches: Array<AnyRouteMatch>,
  assetCrossOrigin?: AssetCrossOriginConfig,
): Array<RouterManagedTag> {
  const routeMeta = matches
    .map((match) => match.meta)
    .filter((meta) => meta !== undefined)

  const resultMeta: Array<RouterManagedTag> = []
  const metaByAttribute: Record<string, true> = {}
  let title: RouterManagedTag | undefined
  for (let i = routeMeta.length - 1; i >= 0; i--) {
    const metas = routeMeta[i]!
    for (let j = metas.length - 1; j >= 0; j--) {
      const m = metas[j]
      if (!m) continue

      if (m.title) {
        if (!title) {
          title = {
            tag: 'title',
            children: m.title,
          }
        }
      } else if ('script:ld+json' in m) {
        try {
          const json = JSON.stringify(m['script:ld+json'])
          resultMeta.push({
            tag: 'script',
            attrs: {
              type: 'application/ld+json',
            },
            children: escapeHtml(json),
          })
        } catch {
          // Skip invalid JSON-LD objects
        }
      } else {
        const attribute = m.name ?? m.property
        if (attribute) {
          if (metaByAttribute[attribute]) {
            continue
          } else {
            metaByAttribute[attribute] = true
          }
        }

        resultMeta.push({
          tag: 'meta',
          attrs: {
            ...m,
            nonce,
          },
        })
      }
    }
  }

  if (title) {
    resultMeta.push(title)
  }

  if (nonce) {
    resultMeta.push({
      tag: 'meta',
      attrs: {
        property: 'csp-nonce',
        content: nonce,
      },
    })
  }
  resultMeta.reverse()

  const constructedLinks = matches
    .flatMap((match) => match.links ?? [])
    .filter((link) => link !== undefined)
    .map((link) => ({
      tag: 'link',
      attrs: {
        ...link,
        nonce,
      },
    })) satisfies Array<RouterManagedTag>

  const manifest = router.ssr?.manifest
  const manifestCssTags: Array<RouterManagedTag> = []
  if (manifest) {
    matches.forEach((match) => {
      const css = manifest.routes[match.routeId]?.css
      css?.forEach((link) => {
        const resolvedLink = resolveManifestCssLink(link)
        manifestCssTags.push({
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            ...resolvedLink,
            crossOrigin:
              getAssetCrossOrigin(assetCrossOrigin, 'stylesheet') ??
              resolvedLink.crossOrigin,
            suppressHydrationWarning: true,
            nonce,
          },
        })
      })
    })

    if (manifest.inlineStyle) {
      manifestCssTags.push({
        tag: 'style',
        attrs: {
          ...manifest.inlineStyle.attrs,
          nonce,
        },
        children: manifest.inlineStyle.children,
        inlineCss: true,
      })
    }
  }

  const preloadLinks: Array<RouterManagedTag> = []
  if (manifest) {
    matches.forEach((match) => {
      manifest.routes[match.routeId]?.preloads?.forEach((preload) => {
        preloadLinks.push({
          tag: 'link',
          attrs: {
            ...getScriptPreloadAttrs(manifest, preload, assetCrossOrigin),
            nonce,
          },
        })
      })
    })
  }

  const styles = matches
    .flatMap((match) => match.styles ?? [])
    .filter((style) => style !== undefined)
    .map(({ children, ...attrs }) => ({
      tag: 'style',
      attrs: {
        ...attrs,
        nonce,
      },
      children: children as string | undefined,
    })) satisfies Array<RouterManagedTag>

  const headScripts = matches
    .flatMap((match) => match.headScripts ?? [])
    .filter((script) => script !== undefined)
    .map(({ children, ...script }) => ({
      tag: 'script',
      attrs: {
        ...script,
        nonce,
      },
      children: children as string | undefined,
    })) satisfies Array<RouterManagedTag>

  const tags: Array<RouterManagedTag> = []
  appendUniqueUserTags(tags, resultMeta)
  tags.push(...preloadLinks)
  appendUniqueUserTags(tags, constructedLinks)
  tags.push(...manifestCssTags)
  appendUniqueUserTags(tags, styles)
  appendUniqueUserTags(tags, headScripts)
  return tags
}

/**
 * Build the list of head/link/meta/script tags to render for active matches.
 * Used internally by `HeadContent`.
 */
export const useTags = (assetCrossOrigin?: AssetCrossOriginConfig) => {
  const router = useRouter()
  const nonce = router.options.ssr?.nonce

  if (isServer ?? router.isServer) {
    return buildTagsFromMatches(
      router,
      nonce,
      router.stores.matches.get(),
      assetCrossOrigin,
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const routeMeta = useStore(
    router.stores.matches,
    (matches) => {
      return matches
        .map((match) => match.meta)
        .filter((meta) => meta !== undefined)
    },
    deepEqual,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const meta: Array<RouterManagedTag> = React.useMemo(() => {
    const resultMeta: Array<RouterManagedTag> = []
    const metaByAttribute: Record<string, true> = {}
    let title: RouterManagedTag | undefined
    for (let i = routeMeta.length - 1; i >= 0; i--) {
      const metas = routeMeta[i]!
      for (let j = metas.length - 1; j >= 0; j--) {
        const m = metas[j]
        if (!m) continue

        if (m.title) {
          if (!title) {
            title = {
              tag: 'title',
              children: m.title,
            }
          }
        } else if ('script:ld+json' in m) {
          // Handle JSON-LD structured data
          // Content is HTML-escaped to prevent XSS when injected via dangerouslySetInnerHTML
          try {
            const json = JSON.stringify(m['script:ld+json'])
            resultMeta.push({
              tag: 'script',
              attrs: {
                type: 'application/ld+json',
              },
              children: escapeHtml(json),
            })
          } catch {
            // Skip invalid JSON-LD objects
          }
        } else {
          const attribute = m.name ?? m.property
          if (attribute) {
            if (metaByAttribute[attribute]) {
              continue
            } else {
              metaByAttribute[attribute] = true
            }
          }

          resultMeta.push({
            tag: 'meta',
            attrs: {
              ...m,
              nonce,
            },
          })
        }
      }
    }

    if (title) {
      resultMeta.push(title)
    }

    if (nonce) {
      resultMeta.push({
        tag: 'meta',
        attrs: {
          property: 'csp-nonce',
          content: nonce,
        },
      })
    }
    resultMeta.reverse()

    return resultMeta
  }, [routeMeta, nonce])

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const links = useStore(
    router.stores.matches,
    (matches) => {
      const constructed = matches
        .flatMap((match) => match.links ?? [])
        .filter((link) => link !== undefined)
        .map((link) => ({
          tag: 'link',
          attrs: {
            ...link,
            nonce,
          },
        })) satisfies Array<RouterManagedTag>

      return constructed
    },
    deepEqual,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const manifestCssTags = useStore(
    router.stores.matches,
    (matches) => {
      const manifest = router.ssr?.manifest
      const tags: Array<RouterManagedTag> = []

      if (!manifest) {
        return tags
      }

      matches.forEach((match) => {
        manifest.routes[match.routeId]?.css?.forEach((link) => {
          const resolvedLink = resolveManifestCssLink(link)
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              ...resolvedLink,
              crossOrigin:
                getAssetCrossOrigin(assetCrossOrigin, 'stylesheet') ??
                resolvedLink.crossOrigin,
              suppressHydrationWarning: true,
              nonce,
            },
          })
        })
      })

      if (manifest.inlineStyle) {
        tags.push({
          tag: 'style',
          attrs: {
            ...manifest.inlineStyle.attrs,
            nonce,
          },
          children: manifest.inlineStyle.children,
          inlineCss: true,
        })
      }

      return tags
    },
    deepEqual,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const preloadLinks = useStore(
    router.stores.matches,
    (matches) => {
      const preloadLinks: Array<RouterManagedTag> = []
      const manifest = router.ssr?.manifest

      if (!manifest) {
        return preloadLinks
      }

      matches.forEach((match) => {
        manifest.routes[match.routeId]?.preloads?.forEach((preload) => {
          preloadLinks.push({
            tag: 'link',
            attrs: {
              ...getScriptPreloadAttrs(manifest, preload, assetCrossOrigin),
              nonce,
            },
          })
        })
      })

      return preloadLinks
    },
    deepEqual,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const styles = useStore(
    router.stores.matches,
    (matches) => {
      return matches
        .flatMap((match) => match.styles ?? [])
        .filter((style) => style !== undefined)
        .map(({ children, ...attrs }) => ({
          tag: 'style',
          attrs: {
            ...attrs,
            nonce,
          },
          children: children as string | undefined,
        })) satisfies Array<RouterManagedTag>
    },
    deepEqual,
  )

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const headScripts: Array<RouterManagedTag> = useStore(
    router.stores.matches,
    (matches) => {
      return matches
        .flatMap((match) => match.headScripts ?? [])
        .filter((script) => script !== undefined)
        .map(({ children, ...script }) => ({
          tag: 'script',
          attrs: {
            ...script,
            nonce,
          },
          children: children as string | undefined,
        })) satisfies Array<RouterManagedTag>
    },
    deepEqual,
  )

  const tags: Array<RouterManagedTag> = []
  appendUniqueUserTags(tags, meta)
  tags.push(...preloadLinks)
  appendUniqueUserTags(tags, links)
  tags.push(...manifestCssTags)
  appendUniqueUserTags(tags, styles)
  appendUniqueUserTags(tags, headScripts)
  return tags
}
