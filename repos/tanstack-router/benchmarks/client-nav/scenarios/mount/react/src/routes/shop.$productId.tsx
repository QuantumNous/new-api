import { createFileRoute } from '@tanstack/react-router'
import { productData } from '../../../shared'

export const Route = createFileRoute('/shop/$productId')({
  loader: ({ params }) => productData(params.productId),
  component: ProductPage,
})

function ProductPage() {
  const product = Route.useLoaderData()

  return <article>{`${product.name}: ${product.price}`}</article>
}
