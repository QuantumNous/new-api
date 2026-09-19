import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/shop/')({
  component: ShopIndexPage,
})

function ShopIndexPage() {
  return <p>All products</p>
}
