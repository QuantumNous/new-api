import * as Vue from 'vue'
import {
  appendUniqueUserTags,
  escapeHtml,
  getAssetCrossOrigin,
  getScriptPreloadAttrs,
  resolveManifestCssLink,
} from '@tanstack/router-core'
import { useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'
import type {
  AssetCrossOriginConfig,
  RouterManagedTag,
} from '@tanstack/router-core'

export const useTags = (assetCrossOrigin?: AssetCrossOriginConfig) => {
  const router = useRouter()
  const matches = useStore(router.stores.matches, (value) => value)

  const meta = Vue.computed<Array<RouterManagedTag>>(() => {
    const resultMeta: Array<RouterManagedTag> = []
    const metaByAttribute: Record<string, true> = {}
    let title: RouterManagedTag | undefined
    ;[...matches.value.map((match) => match.meta!).filter(Boolean)]
      .reverse()
      .forEach((metas) => {
        ;[...metas].reverse().forEach((m) => {
          if (!m) return

          if (m.title) {
            if (!title) {
              title = {
                tag: 'title',
                children: m.title,
              }
            }
          } else if ('script:ld+json' in m) {
            // Handle JSON-LD structured data
            // Content is HTML-escaped to prevent XSS when injected via innerHTML
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
                return
              } else {
                metaByAttribute[attribute] = true
              }
            }

            resultMeta.push({
              tag: 'meta',
              attrs: {
                ...m,
              },
            })
          }
        })
      })

    if (title) {
      resultMeta.push(title)
    }

    resultMeta.reverse()

    return resultMeta
  })

  const links = Vue.computed<Array<RouterManagedTag>>(
    () =>
      matches.value
        .map((match) => match.links!)
        .filter(Boolean)
        .flat(1)
        .map((link) => ({
          tag: 'link',
          attrs: {
            ...link,
          },
        })) as Array<RouterManagedTag>,
  )

  const preloadMeta = Vue.computed<Array<RouterManagedTag>>(() => {
    const preloadMeta: Array<RouterManagedTag> = []

    matches.value.forEach((match) => {
      router.ssr?.manifest?.routes[match.routeId]?.preloads
        ?.filter(Boolean)
        .forEach((preload) => {
          preloadMeta.push({
            tag: 'link',
            attrs: {
              ...getScriptPreloadAttrs(
                router.ssr?.manifest,
                preload,
                assetCrossOrigin,
              ),
            },
          })
        })
    })

    return preloadMeta
  })

  const headScripts = Vue.computed<Array<RouterManagedTag>>(() =>
    (
      matches.value
        .map((match) => match.headScripts!)
        .flat(1)
        .filter(Boolean) as Array<RouterManagedTag>
    ).map(({ children, ...script }) => ({
      tag: 'script',
      attrs: {
        ...script,
      },
      children,
    })),
  )

  const manifestAssets = Vue.computed<Array<RouterManagedTag>>(() => {
    const manifest = router.ssr?.manifest

    const assets: Array<RouterManagedTag> = []

    matches.value.forEach((match) => {
      const routeManifest = manifest?.routes[match.routeId]

      routeManifest?.css?.forEach((link) => {
        const resolvedLink = resolveManifestCssLink(link)
        assets.push({
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            ...resolvedLink,
            crossOrigin:
              getAssetCrossOrigin(assetCrossOrigin, 'stylesheet') ??
              resolvedLink.crossOrigin,
          },
        })
      })
    })

    if (manifest?.inlineStyle) {
      assets.push({
        tag: 'style',
        attrs: manifest.inlineStyle.attrs,
        children: manifest.inlineStyle.children,
        inlineCss: true,
      })
    }

    return assets
  })

  return () => {
    const tags: Array<RouterManagedTag> = []
    tags.push(...manifestAssets.value)
    appendUniqueUserTags(tags, meta.value)
    tags.push(...preloadMeta.value)
    appendUniqueUserTags(tags, links.value)
    appendUniqueUserTags(tags, headScripts.value)
    return tags
  }
}
