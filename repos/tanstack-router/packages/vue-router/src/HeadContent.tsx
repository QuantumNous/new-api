import * as Vue from 'vue'
import { isServer } from '@tanstack/router-core/isServer'

import { Asset } from './Asset'
import { useTags } from './headContentUtils'
import { useRouter } from './useRouter'
import type {
  AssetCrossOriginConfig,
  RouterManagedTag,
} from '@tanstack/router-core'

function attrsMatch(attrs: Record<string, any>, element: Element) {
  let expectedAttrCount = 0

  for (const name in attrs) {
    const value = attrs[name]
    if (value === undefined || value === false || value === null) {
      continue
    }

    expectedAttrCount++
    const attrName = name.toLowerCase()

    if (value === true) {
      if (!element.hasAttribute(attrName)) {
        return false
      }

      continue
    }

    if (element.getAttribute(attrName) !== String(value)) {
      return false
    }
  }

  return expectedAttrCount === element.attributes.length
}

function reconcileHydratedHead(
  tags: Array<RouterManagedTag>,
  preservedHeadTagElements: Record<string, Array<Element>>,
) {
  if (typeof document === 'undefined') {
    return
  }

  const matchedHeadElements = new Set<Element>()
  const hydratedLinks = document.head.querySelectorAll('link')

  for (const tag of tags) {
    if (tag.tag !== 'link') {
      continue
    }

    const attrs = tag.attrs
    const rel =
      typeof attrs?.rel === 'string' ? attrs.rel.toLowerCase() : undefined
    if (rel !== 'stylesheet' && rel !== 'preload' && rel !== 'modulepreload') {
      continue
    }

    for (const element of hydratedLinks) {
      if (!matchedHeadElements.has(element) && attrsMatch(attrs!, element)) {
        matchedHeadElements.add(element)
        const key = JSON.stringify(tag)
        ;(preservedHeadTagElements[key] ||= []).push(element)
        break
      }
    }
  }
}

function cleanupInactivePreservedHeadElements(
  preservedHeadTagElements: Record<string, Array<Element>>,
  activeElements: Set<Element>,
) {
  for (const key in preservedHeadTagElements) {
    const elements = preservedHeadTagElements[key]!
    let nextElements: Array<Element> | undefined

    for (const element of elements) {
      if (activeElements.has(element)) {
        ;(nextElements ||= []).push(element)
      } else if (!shouldRemoveInactivePreservedHeadElement(element)) {
        ;(nextElements ||= []).push(element)
      } else {
        element.remove()
      }
    }

    if (nextElements) {
      preservedHeadTagElements[key] = nextElements
    } else {
      delete preservedHeadTagElements[key]
    }
  }
}

function shouldRemoveInactivePreservedHeadElement(element: Element) {
  const rel = element.getAttribute('rel')?.toLowerCase()
  return rel === 'preload' || rel === 'modulepreload'
}

export interface HeadContentProps {
  assetCrossOrigin?: AssetCrossOriginConfig
}

/**
 * @description The `HeadContent` component is used to render meta tags, links, and scripts for the current route.
 * It should be rendered in the `<head>` of your document.
 */
export const HeadContent = Vue.defineComponent({
  name: 'HeadContent',
  props: {
    assetCrossOrigin: {
      type: [String, Object] as Vue.PropType<AssetCrossOriginConfig>,
      default: undefined,
    },
  },
  setup(props) {
    const router = useRouter()
    const tags = useTags(props.assetCrossOrigin)

    if (isServer ?? router.isServer) {
      return () => {
        return tags().map((tag) => {
          const key = JSON.stringify(tag)
          return Vue.h(Asset, {
            ...tag,
            key: `tsr-meta-${key}`,
          })
        })
      }
    }

    const preservedHeadTagElements: Record<string, Array<Element>> = {}
    let activePreservedHeadElements = new Set<Element>()

    if (router.ssr) {
      reconcileHydratedHead(tags(), preservedHeadTagElements)
    }

    Vue.onUpdated(() => {
      cleanupInactivePreservedHeadElements(
        preservedHeadTagElements,
        activePreservedHeadElements,
      )
    })
    Vue.onUnmounted(() => {
      cleanupInactivePreservedHeadElements(
        preservedHeadTagElements,
        new Set<Element>(),
      )
    })

    return () => {
      const renderedPreservedHeadTagKeys: Record<string, number> = {}
      activePreservedHeadElements = new Set<Element>()
      const renderedTags = tags().map((tag) => {
        const key = JSON.stringify(tag)
        const renderedCount = renderedPreservedHeadTagKeys[key] || 0
        const preservedElement = preservedHeadTagElements[key]?.[renderedCount]
        if (preservedElement?.isConnected) {
          renderedPreservedHeadTagKeys[key] = renderedCount + 1
          activePreservedHeadElements.add(preservedElement)
          return null
        }

        return Vue.h(Asset, {
          ...tag,
          key: `tsr-meta-${key}`,
        })
      })

      return renderedTags
    }
  },
})
