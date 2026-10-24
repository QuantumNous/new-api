import * as Vue from 'vue'
import { getScrollRestorationScriptForRouter } from '@tanstack/router-core/scroll-restoration-script'
import { useRouter } from './useRouter'
import { ScriptOnce } from './ScriptOnce'

export const ScrollRestoration = Vue.defineComponent({
  name: 'ScrollRestoration',
  setup() {
    const router = useRouter()

    return () => {
      const script = getScrollRestorationScriptForRouter(router)

      if (script) {
        return <ScriptOnce children={script} />
      }

      return null
    }
  },
})
