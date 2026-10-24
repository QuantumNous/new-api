import { createServerFn } from '@tanstack/react-start'
import { createCompositeComponent } from '@tanstack/react-start/rsc'

// Shared styles for server-rendered content (blue theme)
const serverStyles = {
  container: {
    backgroundColor: '#e0f2fe',
    border: '2px solid #0284c7',
    borderRadius: '8px',
    padding: '16px',
  },
  badge: {
    backgroundColor: '#0284c7',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  label: {
    color: '#0369a1',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  },
}

/**
 * Product Detail RSC - Fetches product data from the "database" and renders on the server.
 *
 * This demonstrates a realistic use case where:
 * - Product info (name, price, description, stock) is fetched and rendered on the server
 * - The RSC accepts a slot for client-side interactive elements (add to cart, quantity selector)
 * - React Query caches the RSC, so navigating away and back doesn't refetch
 * - Explicitly refetching updates the server timestamp (simulating fresh data)
 */
export const getProductDetailComponent = createServerFn({ method: 'GET' })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const fetchedAt = Date.now()

    // Simulate database fetch with realistic product data
    const product = {
      id: data.productId,
      name: 'Wireless Bluetooth Headphones',
      price: 79.99,
      originalPrice: 99.99,
      description:
        'Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio quality.',
      rating: 4.5,
      reviewCount: 1247,
      inStock: true,
      stockCount: 23,
      sku: `SKU-${data.productId}-WBH`,
    }

    const Info = (
      <div style={serverStyles.container} data-testid="rsc-query-content">
        {/* Server badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <span style={serverStyles.badge}>SERVER RENDERED (RSC)</span>
          <span
            style={{ fontSize: '12px', color: '#64748b' }}
            data-testid="rsc-server-timestamp"
          >
            Fetched: {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Product Header */}
        <h2
          style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
          data-testid="rsc-item-name"
        >
          {product.name}
        </h2>

        {/* Rating */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <span style={{ color: '#f59e0b' }}>
            {'*'.repeat(Math.floor(product.rating))}
          </span>
          <span style={{ color: '#64748b', fontSize: '14px' }}>
            {product.rating} ({product.reviewCount} reviews)
          </span>
        </div>

        {/* Price */}
        <div style={{ marginBottom: '16px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#0c4a6e',
            }}
          >
            ${product.price}
          </span>
          <span
            style={{
              marginLeft: '12px',
              textDecoration: 'line-through',
              color: '#94a3b8',
            }}
          >
            ${product.originalPrice}
          </span>
          <span
            style={{
              marginLeft: '8px',
              color: '#16a34a',
              fontWeight: 'bold',
            }}
          >
            Save ${(product.originalPrice - product.price).toFixed(2)}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            color: '#334155',
            lineHeight: '1.6',
            marginBottom: '16px',
          }}
          data-testid="rsc-item-description"
        >
          {product.description}
        </p>

        {/* Stock Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: product.inStock ? '#16a34a' : '#dc2626',
            }}
          />
          <span
            style={{
              color: product.inStock ? '#16a34a' : '#dc2626',
              fontWeight: '500',
            }}
          >
            {product.inStock
              ? `In Stock (${product.stockCount} available)`
              : 'Out of Stock'}
          </span>
        </div>

        {/* Product Details */}
        <div
          style={{
            borderTop: '1px solid #bae6fd',
            paddingTop: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={serverStyles.label}>Product Details</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            <span style={{ color: '#64748b' }}>Product ID:</span>
            <span style={{ color: '#0c4a6e' }} data-testid="rsc-item-id">
              {product.id}
            </span>
            <span style={{ color: '#64748b' }}>SKU:</span>
            <span style={{ color: '#0c4a6e' }}>{product.sku}</span>
          </div>
        </div>
      </div>
    )

    const src = await createCompositeComponent(
      (props: { children?: React.ReactNode }) => {
        return (
          <div data-testid="rsc-slot-content">
            {Info}
            {props.children}
          </div>
        )
      },
    )

    return { src }
  })
