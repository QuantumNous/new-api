import * as Vue from 'vue'
import { DEV_STYLES_ATTR } from '@tanstack/router-core'

import { Asset } from './Asset'
import { useHydrated } from './ClientOnly'
import { useTags } from './headContentUtils'
import type { AssetCrossOriginConfig } from '@tanstack/router-core'

/**
 * @description The `HeadContent` component is used to render meta tags, links, and scripts for the current route.
 * It should be rendered in the `<head>` of your document.
 *
 * This is the development version that filters out dev styles after hydration.
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
    const tags = useTags(props.assetCrossOrigin)
    const hydrated = useHydrated()

    // Fallback cleanup for hydration mismatch cases
    Vue.onMounted(() => {
      document
        .querySelectorAll(`link[${DEV_STYLES_ATTR}]`)
        .forEach((el) => el.remove())
    })

    return () => {
      // Filter out dev styles after hydration
      const filteredTags = hydrated.value
        ? tags().filter(
            (tag) =>
              tag.tag !== 'link' || tag.attrs?.[DEV_STYLES_ATTR] !== true,
          )
        : tags()

      return filteredTags.map((tag) =>
        Vue.h(Asset, {
          ...tag,
          key: `tsr-meta-${JSON.stringify(tag)}`,
        }),
      )
    }
  },
})
