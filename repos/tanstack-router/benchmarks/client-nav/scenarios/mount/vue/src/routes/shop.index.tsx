import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const ShopIndexPage = Vue.defineComponent({
  setup() {
    return () => <p>All products</p>
  },
})

export const Route = createFileRoute('/shop/')({
  component: ShopIndexPage,
})
