import { useCartStore } from '~/e-Commerce/store/cartStore'

export function Header() {
  const totalItems = useCartStore((state) => state.totalItems)
  const totalPrice = useCartStore((state) => state.totalPrice)

  return (
    <header className="border-6 border-dashed border-green-500 rounded-xl p-4 bg-white shadow-lg mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎸</span>
          <h1 className="text-2xl font-bold text-gray-900">
            TanStack Music Store
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-gray-600 hidden sm:block">
            Premium instruments powered by Server Components
          </p>

          {/* Cart Button */}
          <button className="relative flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="font-semibold">Cart</span>

            {/* Item count badge */}
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cart summary (when items in cart) */}
      {totalItems > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-end gap-4 text-sm">
          <span className="text-gray-600">
            {totalItems} item{totalItems !== 1 ? 's' : ''} in cart
          </span>
          <span className="font-bold text-gray-900">
            Total: ${totalPrice.toFixed(2)}
          </span>
        </div>
      )}
    </header>
  )
}
