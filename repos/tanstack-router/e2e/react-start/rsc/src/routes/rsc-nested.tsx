import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definitions
// ============================================================================

const getProductCardServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching product from database
    const product = {
      id: data.productId,
      name: 'Wireless Noise-Canceling Headphones',
      brand: 'AudioTech Pro',
      price: 299.99,
      originalPrice: 349.99,
      rating: 4.7,
      reviewCount: 1247,
      inStock: true,
      features: [
        '40-hour battery life',
        'Active noise cancellation',
        'Premium comfort design',
      ],
    }

    return createCompositeComponent((props: { children?: React.ReactNode }) => {
      const discount = Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )

      return (
        <div style={serverBox} data-testid="rsc-product-card">
          <div style={serverHeader}>
            <span style={serverBadge}>PRODUCT CARD (OUTER RSC)</span>
            <span style={timestamp} data-testid="rsc-product-timestamp">
              {new Date(serverTimestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Product Info */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div
              style={{
                width: '120px',
                height: '120px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
              }}
            >
              🎧
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '4px',
                }}
              >
                {product.brand}
              </div>
              <h3
                style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
                data-testid="rsc-product-name"
              >
                {product.name}
              </h3>
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}
              >
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="rsc-product-price"
                >
                  ${product.price}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    textDecoration: 'line-through',
                  }}
                >
                  ${product.originalPrice}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#16a34a',
                    fontWeight: 'bold',
                  }}
                >
                  {discount}% OFF
                </span>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#f59e0b' }}>★</span>
                <span style={{ fontWeight: 'bold', color: '#334155' }}>
                  {product.rating}
                </span>
                <span style={{ color: '#64748b', fontSize: '13px' }}>
                  ({product.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#0369a1',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}
            >
              KEY FEATURES
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#334155',
                fontSize: '14px',
              }}
            >
              {product.features.map((feature, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Nested content slot */}
          <div
            style={{
              borderTop: '1px solid #bae6fd',
              paddingTop: '16px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#0369a1',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}
            >
              NESTED CONTENT (CLIENT + RSC)
            </div>
            <div data-testid="rsc-product-children">{props.children}</div>
          </div>
        </div>
      )
    })
  })

const getProductReviewsServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching reviews from database
    const reviews = [
      {
        id: 'rev_1',
        author: 'MusicLover42',
        rating: 5,
        date: '2 days ago',
        title: 'Best headphones I have ever owned!',
        content:
          'The noise cancellation is incredible. Perfect for my daily commute.',
        helpful: 127,
      },
      {
        id: 'rev_2',
        author: 'TechReviewer',
        rating: 4,
        date: '1 week ago',
        title: 'Great sound, minor comfort issue',
        content:
          'Excellent audio quality. Gets slightly warm after 3+ hours of use.',
        helpful: 84,
      },
      {
        id: 'rev_3',
        author: 'CasualListener',
        rating: 5,
        date: '2 weeks ago',
        title: 'Worth every penny',
        content:
          'Battery life is exactly as advertised. Very happy with this purchase.',
        helpful: 56,
      },
    ]

    return createCompositeComponent(
      (props: { renderActions?: (reviewId: string) => React.ReactNode }) => {
        return (
          <div
            style={{
              ...serverBox,
              marginTop: '12px',
            }}
            data-testid="rsc-product-reviews"
          >
            <div style={serverHeader}>
              <span style={serverBadge}>REVIEWS (INNER RSC)</span>
              <span style={timestamp} data-testid="rsc-reviews-timestamp">
                {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <h4
              style={{ margin: '0 0 12px 0', color: '#0c4a6e' }}
              data-testid="rsc-reviews-title"
            >
              Customer Reviews for Product {data.productId}
            </h4>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {reviews.map((review) => (
                <div
                  key={review.id}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                  }}
                  data-testid={`review-${review.id}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#0c4a6e' }}>
                        {review.author}
                      </span>
                      <span
                        style={{
                          marginLeft: '8px',
                          color: '#f59e0b',
                          fontSize: '13px',
                        }}
                      >
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {review.date}
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: '600',
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    {review.title}
                  </div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '14px',
                      marginBottom: '8px',
                    }}
                  >
                    {review.content}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {review.helpful} people found this helpful
                    </span>
                    {props.renderActions?.(review.id)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      },
    )
  })

export const Route = createFileRoute('/rsc-nested')({
  loader: async () => {
    // Load both RSCs in parallel - they will be composed on the client
    const [ProductCard, ProductReviews] = await Promise.all([
      getProductCardServerComponent({ data: { productId: 'HEADPHONES-001' } }),
      getProductReviewsServerComponent({
        data: { productId: 'HEADPHONES-001' },
      }),
    ])
    return {
      ProductCard,
      ProductReviews,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscNestedComponent,
})

// Client component that wraps the inner RSC - simulates a "Reviews Section" toggle
function ReviewsSection({
  children,
  isExpanded,
  onToggle,
  helpfulReviews,
}: {
  children: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  helpfulReviews: Set<string>
}) {
  return (
    <div style={clientStyles.container} data-testid="reviews-section">
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>CLIENT WRAPPER</span>
        <span style={{ fontSize: '12px', color: '#166534' }}>
          Marked {helpfulReviews.size} as helpful
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '12px' : '0',
        }}
      >
        <div>
          <h4 style={{ margin: 0, color: '#166534' }}>Customer Reviews</h4>
          <p
            style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}
          >
            This section demonstrates a client component wrapping an inner RSC
          </p>
        </div>
        <button
          data-testid="toggle-reviews-btn"
          onClick={onToggle}
          style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
        >
          {isExpanded ? 'Collapse Reviews' : 'Show Reviews'}
        </button>
      </div>

      {isExpanded && <div data-testid="reviews-content">{children}</div>}
    </div>
  )
}

function RscNestedComponent() {
  const { ProductCard, ProductReviews, loaderTimestamp } = Route.useLoaderData()
  const [showReviews, setShowReviews] = React.useState(true)
  const [helpfulReviews, setHelpfulReviews] = React.useState<Set<string>>(
    new Set(),
  )

  const markHelpful = (reviewId: string) => {
    setHelpfulReviews((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) {
        next.delete(reviewId)
      } else {
        next.add(reviewId)
      }
      return next
    })
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-nested-title" style={pageStyles.title}>
        E-commerce Product Page - Nested RSCs
      </h1>
      <p style={pageStyles.description}>
        This example shows RSCs nested inside each other via client composition.
        The outer RSC (Product Card - blue) contains a client component (Reviews
        Section - green) which wraps an inner RSC (Reviews - light green). Each
        RSC has its own server timestamp showing they were fetched
        independently.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Outer RSC (Product Card) with nested content */}
      <CompositeComponent src={ProductCard}>
        {/* Client component that wraps the inner RSC */}
        <ReviewsSection
          isExpanded={showReviews}
          onToggle={() => setShowReviews((s) => !s)}
          helpfulReviews={helpfulReviews}
        >
          {/* Inner RSC (Reviews) with render prop for client actions */}
          <CompositeComponent
            src={ProductReviews}
            renderActions={(reviewId: string) => (
              <button
                data-testid={`helpful-btn-${reviewId}`}
                onClick={() => markHelpful(reviewId)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: helpfulReviews.has(reviewId)
                    ? '#16a34a'
                    : '#e2e8f0',
                  color: helpfulReviews.has(reviewId) ? 'white' : '#64748b',
                }}
              >
                {helpfulReviews.has(reviewId) ? '✓ Marked Helpful' : 'Helpful?'}
              </button>
            )}
          />
        </ReviewsSection>
      </CompositeComponent>

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
          <li>
            Outer RSC (Product Card) and Inner RSC (Reviews) are loaded in
            parallel in the route loader
          </li>
          <li>
            The client composes them together: ProductCard → ReviewsSection
            (client) → ProductReviews
          </li>
          <li>
            Each RSC has its own timestamp - collapsing/expanding doesn't
            refetch either one
          </li>
          <li>
            The "Helpful" buttons are client-interactive render props passed
            into the inner RSC
          </li>
          <li>
            This pattern allows mixing server-rendered content with client
            interactivity at any nesting level
          </li>
        </ul>
      </div>
    </div>
  )
}
