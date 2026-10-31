import * as Vue from 'vue'
import { RouterProvider } from '@tanstack/vue-router'
import type { AnyRouter } from '@tanstack/router-core'

export const StartClient = Vue.defineComponent({
  name: 'StartClient',
  props: {
    router: {
      type: Object as () => AnyRouter,
      required: true,
    },
  },
  setup(props) {
    // After Vue hydration is complete, signal that router hydration is complete so cleanup can happen if stream has ended
    // Use nextTick to ensure all child component onMounted hooks have completed
    // This prevents the cleanup to happen before components have finished transitioning
    Vue.onMounted(() => {
      Vue.nextTick(() => {
        window.$_TSR?.h()
      })
    })

    return () => <RouterProvider router={props.router} />
  },
})
