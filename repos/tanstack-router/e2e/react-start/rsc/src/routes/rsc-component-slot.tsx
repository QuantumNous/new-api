import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import { clientStyles, formatTime, pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// COMPONENT SLOT: Passing React Components directly as props
// ============================================================================

const getProductCardServer = createServerFn({ method: 'GET' })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching product data from server
    const product = {
      id: data.productId,
      name: 'Premium Wireless Headphones',
      price: 299.99,
      rating: 4.8,
      reviewCount: 1247,
    }

    return createCompositeComponent(
      (props: {
        // Component passed as a prop (not render prop, not children)
        ActionButton?: React.ComponentType<{ productId: string; price: number }>
        BadgeComponent?: React.ComponentType<{ rating: number }>
      }) => {
        const { ActionButton, BadgeComponent } = props

        return (
          <div style={serverBox} data-testid="rsc-product-card">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER PRODUCT CARD</span>
              <span style={timestamp} data-testid="rsc-product-timestamp">
                Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              {/* Product image placeholder */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  backgroundColor: '#bae6fd',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0369a1',
                  fontSize: '12px',
                }}
                data-testid="product-image"
              >
                [Product Image]
              </div>

              {/* Product details */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <h3
                    style={{ margin: 0, color: '#0c4a6e' }}
                    data-testid="product-name"
                  >
                    {product.name}
                  </h3>
                  {/* Badge component slot */}
                  {BadgeComponent && (
                    <div data-testid="badge-slot">
                      <BadgeComponent rating={product.rating} />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                    marginBottom: '4px',
                  }}
                  data-testid="product-price"
                >
                  ${product.price}
                </div>

                <div
                  style={{ fontSize: '13px', color: '#64748b' }}
                  data-testid="product-reviews"
                >
                  ⭐ {product.rating} ({product.reviewCount.toLocaleString()}{' '}
                  reviews)
                </div>

                {/* Action button component slot */}
                <div
                  style={{ marginTop: '12px' }}
                  data-testid="action-button-slot"
                >
                  {ActionButton && (
                    <ActionButton
                      productId={product.id}
                      price={product.price}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      },
    )
  })

// Client components to be passed as props
function AddToCartButton({
  productId,
  price,
  quantity,
  onQuantityChange,
}: {
  productId: string
  price: number
  quantity: number
  onQuantityChange: (q: number) => void
}) {
  const [isAdding, setIsAdding] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const handleClick = () => {
    setIsAdding(true)
    setTimeout(() => {
      setIsAdding(false)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    }, 500)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#dcfce7',
        border: '1px solid #16a34a',
        borderRadius: '6px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#166534',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        }}
      >
        CLIENT COMPONENT
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          data-testid="decrease-qty-btn"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: '1px solid #16a34a',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          -
        </button>
        <span
          data-testid="quantity-display"
          style={{ minWidth: '24px', textAlign: 'center' }}
        >
          {quantity}
        </span>
        <button
          data-testid="increase-qty-btn"
          onClick={() => onQuantityChange(quantity + 1)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: '1px solid #16a34a',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          +
        </button>
      </div>
      <button
        data-testid="add-to-cart-btn"
        onClick={handleClick}
        disabled={isAdding}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: added ? '#22c55e' : '#16a34a',
          color: 'white',
          fontWeight: 'bold',
          cursor: isAdding ? 'not-allowed' : 'pointer',
          opacity: isAdding ? 0.7 : 1,
        }}
      >
        {isAdding
          ? 'Adding...'
          : added
            ? '✓ Added!'
            : `Add to Cart - $${(price * quantity).toFixed(2)}`}
      </button>
      <span
        data-testid="product-id-display"
        style={{ fontSize: '11px', color: '#64748b' }}
      >
        ID: {productId}
      </span>
    </div>
  )
}

function RatingBadge({
  rating,
  showDetails,
}: {
  rating: number
  showDetails: boolean
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: '#dcfce7',
        border: '1px solid #16a34a',
        borderRadius: '12px',
        fontSize: '12px',
        color: '#166534',
        fontWeight: 'bold',
      }}
      data-testid="rating-badge"
    >
      ⭐ {rating}
      {showDetails && (
        <span data-testid="rating-details" style={{ fontWeight: 'normal' }}>
          {' '}
          (Excellent)
        </span>
      )}
    </div>
  )
}

export const Route = createFileRoute('/rsc-component-slot')({
  loader: async () => {
    const ProductCard = await getProductCardServer({
      data: { productId: 'PRD-12345' },
    })
    return {
      ProductCard,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscComponentSlotPage,
})

function RscComponentSlotPage() {
  const { ProductCard, loaderTimestamp } = Route.useLoaderData()
  const [quantity, setQuantity] = React.useState(1)
  const [showBadgeDetails, setShowBadgeDetails] = React.useState(false)

  // Create wrapper components that close over client state
  const ActionButtonWithState = React.useCallback(
    ({ productId, price }: { productId: string; price: number }) => (
      <AddToCartButton
        productId={productId}
        price={price}
        quantity={quantity}
        onQuantityChange={setQuantity}
      />
    ),
    [quantity],
  )

  const BadgeWithState = React.useCallback(
    ({ rating }: { rating: number }) => (
      <RatingBadge rating={rating} showDetails={showBadgeDetails} />
    ),
    [showBadgeDetails],
  )

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-component-slot-title" style={pageStyles.title}>
        Product Card with Component Slots
      </h1>
      <p style={pageStyles.description}>
        The product card layout and data are server-rendered (blue), while
        interactive components are passed as props (green). Changing client
        state does NOT refetch the server component - watch the timestamp!
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Client Controls */}
      <div style={clientStyles.container} data-testid="controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT CONTROLS</span>
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}>
          These controls modify the component props. The server layout won't
          reload!
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            data-testid="toggle-badge-details-btn"
            onClick={() => setShowBadgeDetails((s) => !s)}
            style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
          >
            {showBadgeDetails ? 'Hide' : 'Show'} Badge Details
          </button>
          <button
            data-testid="reset-quantity-btn"
            onClick={() => setQuantity(1)}
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            Reset Quantity
          </button>
        </div>
      </div>

      {/* Server component with component slots */}
      <CompositeComponent
        src={ProductCard}
        ActionButton={ActionButtonWithState}
        BadgeComponent={BadgeWithState}
      />

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
          <li>Components are passed as props (not children or render props)</li>
          <li>Server component provides data to client components via props</li>
          <li>Client components can have their own state (quantity, etc.)</li>
          <li>
            State changes in client components don't trigger server refetch
          </li>
          <li>Server timestamp remains constant while interactions occur</li>
        </ul>
      </div>
    </div>
  )
}
