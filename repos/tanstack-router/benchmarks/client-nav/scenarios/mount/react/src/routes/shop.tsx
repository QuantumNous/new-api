import { Outlet, createFileRoute } from '@tanstack/react-router'
import { shopContext } from '../../../shared'

export const Route = createFileRoute('/shop')({
  beforeLoad: () => shopContext(),
  component: ShopLayout,
})

function ShopLayout() {
  return (
    <section>
      <h2>Shop</h2>
      <Outlet />
    </section>
  )
}
