import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'

const Layout = Vue.defineComponent({
  setup() {
    return () => <Outlet />
  },
})

export const Route = createFileRoute('/sec-e')({
  component: Layout,
})
