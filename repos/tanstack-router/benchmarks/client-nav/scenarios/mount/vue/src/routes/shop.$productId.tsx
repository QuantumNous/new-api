import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { productData } from '../../../shared'

const ProductPage = Vue.defineComponent({
  setup() {
    const product = Route.useLoaderData()

    return () => (
      <article>{`${product.value.name}: ${product.value.price}`}</article>
    )
  },
})

export const Route = createFileRoute('/shop/$productId')({
  loader: ({ params }) => productData(params.productId),
  component: ProductPage,
})
