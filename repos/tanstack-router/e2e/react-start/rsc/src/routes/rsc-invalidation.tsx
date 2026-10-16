import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

const getSearchResultsServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { query: string; page: number }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const instanceId = Math.random().toString(36).slice(2, 8)

    // Simulate search results based on query
    const allProducts = [
      {
        id: 1,
        name: 'Wireless Headphones',
        category: 'Electronics',
        price: 99,
      },
      { id: 2, name: 'Bluetooth Speaker', category: 'Electronics', price: 79 },
      { id: 3, name: 'USB-C Cable', category: 'Electronics', price: 15 },
      { id: 4, name: 'Laptop Stand', category: 'Accessories', price: 45 },
      {
        id: 5,
        name: 'Mechanical Keyboard',
        category: 'Electronics',
        price: 129,
      },
      { id: 6, name: 'Mouse Pad', category: 'Accessories', price: 25 },
      { id: 7, name: 'Webcam HD', category: 'Electronics', price: 89 },
      { id: 8, name: 'Monitor Light', category: 'Accessories', price: 55 },
    ]

    const filtered = data.query
      ? allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(data.query.toLowerCase()) ||
            p.category.toLowerCase().includes(data.query.toLowerCase()),
        )
      : allProducts

    const pageSize = 3
    const startIndex = (data.page - 1) * pageSize
    const results = filtered.slice(startIndex, startIndex + pageSize)
    const totalPages = Math.ceil(filtered.length / pageSize)

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-search-results">
        <div style={serverHeader}>
          <span style={serverBadge}>SEARCH RESULTS</span>
          <span style={timestamp} data-testid="rsc-search-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0, color: '#0c4a6e' }}>
            Results for "{data.query || 'all products'}"
          </h3>
          <span
            style={{ fontSize: '12px', color: '#64748b' }}
            data-testid="rsc-search-instance"
          >
            Instance: {instanceId}
          </span>
        </div>

        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#0369a1',
          }}
          data-testid="rsc-search-meta"
        >
          Showing page {data.page} of {totalPages} ({filtered.length} total
          results)
        </div>

        {results.length === 0 ? (
          <div
            style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}
            data-testid="rsc-search-empty"
          >
            No results found for "{data.query}"
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map((product) => (
              <div
                key={product.id}
                style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #bae6fd',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                data-testid={`search-result-${product.id}`}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0c4a6e' }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {product.category}
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 'bold',
                    color: '#0284c7',
                    fontSize: '18px',
                  }}
                >
                  ${product.price}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>,
    )
  })

type SearchParams = {
  q?: string
  page?: number
}

export const Route = createFileRoute('/rsc-invalidation')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: (search.q as string) || '',
    page: Number(search.page) || 1,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const SearchResults = await getSearchResultsServerComponent({
      data: {
        query: deps.search.q || '',
        page: deps.search.page || 1,
      },
    })
    return {
      SearchResults,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscInvalidationComponent,
})

function RscInvalidationComponent() {
  const { SearchResults, loaderTimestamp } = Route.useLoaderData()
  const { q, page } = Route.useSearch()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = React.useState(q || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({
      to: '/rsc-invalidation',
      search: { q: searchInput, page: 1 },
    })
  }

  const handlePageChange = (newPage: number) => {
    navigate({
      to: '/rsc-invalidation',
      search: { q, page: newPage },
    })
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-invalidation-title" style={pageStyles.title}>
        Product Search - RSC Invalidation
      </h1>
      <p style={pageStyles.description}>
        This example tests RSC invalidation when search params change. The RSC
        refetches when you search or change pages - watch the timestamp and
        instance ID change. This verifies RSCs properly invalidate when they
        should.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Search Controls */}
      <div style={clientStyles.container} data-testid="search-controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT SEARCH</span>
        </div>

        <form
          onSubmit={handleSearch}
          style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            data-testid="search-input"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            data-testid="search-btn"
            style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
          >
            Search
          </button>
        </form>

        {/* Quick filter buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            data-testid="filter-all"
            onClick={() => {
              setSearchInput('')
              navigate({ to: '/rsc-invalidation', search: { q: '', page: 1 } })
            }}
            style={{
              ...clientStyles.button,
              ...(!q
                ? clientStyles.primaryButton
                : clientStyles.secondaryButton),
            }}
          >
            All Products
          </button>
          <button
            data-testid="filter-electronics"
            onClick={() => {
              setSearchInput('Electronics')
              navigate({
                to: '/rsc-invalidation',
                search: { q: 'Electronics', page: 1 },
              })
            }}
            style={{
              ...clientStyles.button,
              ...(q === 'Electronics'
                ? clientStyles.primaryButton
                : clientStyles.secondaryButton),
            }}
          >
            Electronics
          </button>
          <button
            data-testid="filter-accessories"
            onClick={() => {
              setSearchInput('Accessories')
              navigate({
                to: '/rsc-invalidation',
                search: { q: 'Accessories', page: 1 },
              })
            }}
            style={{
              ...clientStyles.button,
              ...(q === 'Accessories'
                ? clientStyles.primaryButton
                : clientStyles.secondaryButton),
            }}
          >
            Accessories
          </button>
        </div>

        <div
          style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}
          data-testid="current-params"
        >
          Current: q="{q || ''}" page={page}
        </div>
      </div>

      {/* Search Results RSC */}
      {SearchResults}

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '16px',
        }}
      >
        <button
          data-testid="prev-page"
          onClick={() => handlePageChange(Math.max(1, (page || 1) - 1))}
          disabled={page === 1}
          style={{
            ...clientStyles.button,
            ...clientStyles.secondaryButton,
            opacity: page === 1 ? 0.5 : 1,
          }}
        >
          Previous
        </button>
        <span
          style={{
            padding: '8px 16px',
            backgroundColor: '#e0f2fe',
            borderRadius: '6px',
            fontWeight: 'bold',
            color: '#0284c7',
          }}
          data-testid="current-page"
        >
          Page {page || 1}
        </span>
        <button
          data-testid="next-page"
          onClick={() => handlePageChange((page || 1) + 1)}
          style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
        >
          Next
        </button>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>RSC refetches when search query changes</li>
          <li>RSC refetches when page number changes</li>
          <li>Each refetch gets a new timestamp and instance ID</li>
          <li>Uses loaderDeps to depend on search params</li>
        </ul>
      </div>
    </div>
  )
}
