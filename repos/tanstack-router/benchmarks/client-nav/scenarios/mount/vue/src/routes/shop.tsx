import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { shopContext } from '../../../shared'

const ShopLayout = Vue.defineComponent({
  setup() {
    return () => (
      <section>
        <h2>Shop</h2>
        <Outlet />
      </section>
    )
  },
})

export const Route = createFileRoute('/shop')({
  beforeLoad: () => shopContext(),
  component: ShopLayout,
})
