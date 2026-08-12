import { useState } from 'react'
import { useCartStore } from '~/e-Commerce/store/cartStore'

// Product info passed from parent
const product = {
  id: 'tanstack-ukulele',
  name: 'TanStack Ukulele',
  price: 149.99,
  image: '/example-ukelele-tanstack.jpg',
}

export function AddToCartButton() {
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    // Add item(s) to cart
    for (let i = 0; i < quantity; i++) {
      addItem(product)
    }
    setAdded(true)
    setQuantity(1) // Reset quantity after adding
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="border-6 border-dashed border-green-500 rounded-lg p-4 space-y-4">
      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-gray-700 font-medium">Quantity:</span>
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-2 hover:bg-gray-100 transition-colors"
          >
            -
          </button>
          <span className="px-4 py-2 border-x border-gray-300 min-w-[50px] text-center">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 py-2 hover:bg-gray-100 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
            added
              ? 'bg-green-600 text-white'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {added
            ? '✓ Added to Bag!'
            : `Add to Bag${quantity > 1 ? ` (${quantity})` : ''}`}
        </button>

        <button
          onClick={() => setFavorite(!favorite)}
          className={`px-4 py-3 rounded-lg border-2 transition-all ${
            favorite
              ? 'border-red-500 bg-red-50 text-red-500'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favorite ? '❤️' : '🤍'}
        </button>
      </div>

      {/* Info text */}
      <p className="text-sm text-gray-500 text-center">
        Free shipping on orders over $100
      </p>
    </div>
  )
}
