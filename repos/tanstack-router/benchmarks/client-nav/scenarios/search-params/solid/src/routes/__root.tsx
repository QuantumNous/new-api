import { createRenderEffect } from 'solid-js'
import {
  Link,
  Outlet,
  createRootRoute,
  useSearch,
} from '@tanstack/solid-router'
import {
  changedCategories,
  computeChecksum,
  initialProductsSearch,
} from '../../../shared'

export const Route = createRootRoute({
  component: RootComponent,
})

const rootSubscribers = Array.from({ length: 4 }, (_, index) => index)

function PerfValue(props: { value: () => number }) {
  createRenderEffect(() => {
    void props.value()
  })

  return null
}

function RootSearchSubscriber() {
  const value = useSearch({
    strict: false,
    select: (search) => computeChecksum(Number(search.page ?? 0)),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function RootComponent() {
  return (
    <>
      {rootSubscribers.map(() => (
        <RootSearchSubscriber />
      ))}
      <nav>
        <Link to="/" data-testid="go-home" activeProps={{ class: 'active' }}>
          Home
        </Link>
        <Link
          to="/products"
          search={initialProductsSearch}
          data-testid="go-products"
          activeProps={{ class: 'active' }}
        >
          Products
        </Link>
        <Link
          from="/products"
          to="."
          search={(prev) => ({ ...prev, page: prev.page + 1 })}
          data-testid="products-next-page"
        >
          Next page
        </Link>
        <Link
          from="/products"
          to="."
          search={(prev) => ({
            ...prev,
            filters: { ...prev.filters, categories: changedCategories },
          })}
          data-testid="products-categories"
        >
          Change categories
        </Link>
        <Link
          from="/products"
          to="."
          search={(prev) => ({
            ...prev,
            sort: prev.sort === 'asc' ? 'desc' : 'asc',
          })}
          data-testid="products-sort"
        >
          Toggle sort
        </Link>
        <Link
          from="/products"
          to="."
          search={(prev) => ({ ...prev, page: 1, q: '' })}
          data-testid="products-reset"
        >
          Reset
        </Link>
        <Link
          to="/catalog"
          search={true}
          data-testid="go-catalog"
          activeOptions={{ includeSearch: false }}
        >
          Catalog
        </Link>
        <Link
          from="/catalog"
          to="."
          search={(prev) => ({ ...prev, page: prev.page + 1 })}
          data-testid="catalog-next-page"
        >
          Catalog next page
        </Link>
        <Link
          to="/products"
          search={{ q: 'reset' }}
          data-testid="products-partial"
        >
          Products partial
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
