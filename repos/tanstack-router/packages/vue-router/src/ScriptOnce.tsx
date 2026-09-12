import * as Vue from 'vue'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'

export const ScriptOnce = Vue.defineComponent({
  name: 'ScriptOnce',
  props: {
    children: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter()

    if (isServer ?? router.isServer) {
      return () => (
        <script
          nonce={router.options.ssr?.nonce}
          innerHTML={props.children + ';document.currentScript.remove()'}
        />
      )
    }

    const mounted = Vue.ref(false)
    Vue.onMounted(() => {
      mounted.value = true
    })

    return () => {
      if (mounted.value) {
        return null
      }

      return (
        <script
          nonce={router.options.ssr?.nonce}
          data-allow-mismatch
          innerHTML=""
        />
      )
    }
  },
})
