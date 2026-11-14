import * as Vue from 'vue'
import { RouterProvider } from '@tanstack/vue-router'
import type { AnyRouter } from '@tanstack/router-core'

export const StartServer = Vue.defineComponent({
  name: 'StartServer',
  props: {
    router: {
      type: Object as () => AnyRouter,
      required: true,
    },
  },
  setup(props) {
    return () => Vue.h(RouterProvider, { router: props.router })
  },
})
