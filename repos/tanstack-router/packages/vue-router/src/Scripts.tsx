import * as Vue from 'vue'
import { useStore } from '@tanstack/vue-store'
import { isServer } from '@tanstack/router-core/isServer'
import { Asset } from './Asset'
import { useRouter } from './useRouter'
import type { RouterManagedTag } from '@tanstack/router-core'

type ScriptsRenderState = {
  scripts: Array<RouterManagedTag>
  assetScripts: Array<RouterManagedTag>
  mounted: boolean
  nonce?: string
}

export const Scripts = Vue.defineComponent({
  name: 'Scripts',
  setup() {
    const router = useRouter()
    const nonce = router.options.ssr?.nonce
    const matches = useStore(router.stores.matches, (value) => value)

    const getAssetScripts = (matches: Array<any>) => {
      const assetScripts: Array<RouterManagedTag> = []
      const manifest = router.ssr?.manifest

      if (!manifest) {
        return []
      }

      matches.forEach((match) => {
        const routeManifest = manifest.routes[match.routeId]

        routeManifest?.scripts?.forEach((asset) => {
          assetScripts.push({
            tag: 'script',
            attrs: { ...asset.attrs, nonce },
            children: asset.children,
          })
        })
      })

      return assetScripts
    }

    const getScripts = (matches: Array<any>): Array<RouterManagedTag> =>
      (
        matches
          .map((match) => match.scripts!)
          .flat(1)
          .filter(Boolean) as Array<RouterManagedTag>
      ).map(
        ({ children, ...script }) =>
          ({
            tag: 'script',
            attrs: {
              ...script,
              nonce,
            },
            children,
          }) satisfies RouterManagedTag,
      )

    const assetScripts = Vue.computed<Array<RouterManagedTag>>(() =>
      getAssetScripts(matches.value),
    )
    const scripts = Vue.computed<Array<RouterManagedTag>>(() =>
      getScripts(matches.value),
    )

    const mounted = Vue.ref(false)
    Vue.onMounted(() => {
      mounted.value = true
    })

    return () =>
      renderScripts(router, {
        scripts: scripts.value,
        assetScripts: assetScripts.value,
        mounted: mounted.value,
        nonce,
      })
  },
})

function renderScripts(
  router: ReturnType<typeof useRouter>,
  { scripts, assetScripts, mounted, nonce }: ScriptsRenderState,
) {
  const allScripts: Array<RouterManagedTag> = []

  if ((isServer ?? router.isServer) && router.serverSsr) {
    const serverBufferedScript = router.serverSsr.takeBufferedScripts()
    if (serverBufferedScript) {
      allScripts.push(serverBufferedScript)
    }
  } else if (router.ssr && !mounted) {
    allScripts.push({
      tag: 'script',
      attrs: { nonce, 'data-allow-mismatch': true },
      children: '',
    } satisfies RouterManagedTag)

    allScripts.push({
      tag: 'script',
      attrs: {
        nonce,
        id: '$tsr-stream-barrier',
        'data-allow-mismatch': true,
      },
      children: '',
    } satisfies RouterManagedTag)

    for (const asset of assetScripts) {
      allScripts.push({
        tag: 'script',
        attrs: {
          ...asset.attrs,
          'data-allow-mismatch': true,
        },
        children: '',
      } satisfies RouterManagedTag)
    }
  }

  allScripts.push(...scripts)

  if (mounted || ((isServer ?? router.isServer) && router.serverSsr)) {
    allScripts.push(...assetScripts)
  }

  return (
    <>
      {allScripts.map((asset, i) => (
        <Asset {...asset} key={`tsr-scripts-${asset.tag}-${i}`} />
      ))}
    </>
  )
}
