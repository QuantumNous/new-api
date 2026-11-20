import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { getProductDetailComponent } from '~/utils/serverComponents'
import { clientStyles, colors, pageStyles } from '~/utils/styles'

// Query options for fetching the product RSC via React Query
const productQueryOptions = (productId: string) => ({
  queryKey: ['product', productId],
  structuralSharing: false,
  queryFn: () => getProductDetailComponent({ data: { productId } }),
})

export const Route = createFileRoute('/rsc-query')({
  loader: async ({ context }) => {
    // Prefetch the product RSC via React Query during SSR
    // This data will be reused on the client without refetching
    await context.queryClient.ensureQueryData(productQueryOptions('WBH-2024'))
  },
  component: ProductPage,
})

function ProductPage() {
  const queryClient = useQueryClient()

  // Get the cached RSC from React Query
  const { data: ProductDetail } = useSuspenseQuery(
    productQueryOptions('WBH-2024'),
  )

  const handleRefreshProduct = async () => {
    // Refetch the RSC - this will update the server timestamp
    await queryClient.refetchQueries({ queryKey: ['product'] })
  }

  return (
    <div data-testid="rsc-query-page" style={pageStyles.container}>
      <h1 style={pageStyles.title}>Product Detail Page</h1>
      <p style={pageStyles.description}>
        This page demonstrates RSC + React Query integration. The product info
        is rendered on the server (blue), while interactive elements are
        client-side (green).
      </p>

      {/* Legend */}
      <div style={pageStyles.legend}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.server)} />
          <span style={pageStyles.legendText}>Server Rendered (RSC)</span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor(colors.client)} />
          <span style={pageStyles.legendText}>Client Interactive</span>
        </div>
      </div>

      {/* Server-rendered Product Detail with Client Slot */}
      <CompositeComponent src={ProductDetail.src}>
        <AddToCartWidget onRefresh={handleRefreshProduct} />
      </CompositeComponent>
    </div>
  )
}

/**
 * Client-side "Add to Cart" widget - demonstrates interactive elements
 * that live inside the server component's slot.
 */
function AddToCartWidget({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [quantity, setQuantity] = useState(1)
  const [isInCart, setIsInCart] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleAddToCart = () => {
    setIsInCart(true)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  return (
    <div style={clientStyles.container} data-testid="client-slot">
      {/* Client badge */}
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>CLIENT INTERACTIVE</span>
      </div>

      {/* Quantity Selector */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            ...clientStyles.label,
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Quantity
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            style={{
              ...clientStyles.button,
              ...clientStyles.secondaryButton,
              padding: '8px 16px',
            }}
            data-testid="quantity-decrease-btn"
          >
            -
          </button>
          <span
            style={{
              padding: '8px 20px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              minWidth: '50px',
              textAlign: 'center',
            }}
            data-testid="quantity-value"
          >
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            style={{
              ...clientStyles.button,
              ...clientStyles.secondaryButton,
              padding: '8px 16px',
            }}
            data-testid="quantity-increase-btn"
          >
            +
          </button>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isInCart}
        style={{
          ...clientStyles.button,
          ...clientStyles.primaryButton,
          width: '100%',
          marginBottom: '12px',
          opacity: isInCart ? 0.7 : 1,
        }}
        data-testid="add-to-cart-btn"
      >
        {isInCart
          ? `Added to Cart (${quantity})`
          : `Add to Cart - $${(79.99 * quantity).toFixed(2)}`}
      </button>

      {/* Refresh Product Data */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        style={{
          ...clientStyles.button,
          ...clientStyles.secondaryButton,
          width: '100%',
        }}
        data-testid="refetch-rsc-btn"
      >
        {isRefreshing ? 'Refreshing...' : 'Refresh Product Data (Refetch RSC)'}
      </button>

      {/* Hidden elements for test compatibility */}
      <span data-testid="slot-content" style={{ display: 'none' }}>
        Client slot content
      </span>
    </div>
  )
}
