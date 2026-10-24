import { create } from 'zustand'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

interface CartStore {
  items: Array<CartItem>
  totalItems: number
  totalPrice: number
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  totalItems: 0,
  totalPrice: 0,

  addItem: (item) => {
    const { items } = get()
    const existingItem = items.find((i) => i.id === item.id)

    if (existingItem) {
      set({
        items: items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
        totalItems: get().totalItems + 1,
        totalPrice: get().totalPrice + item.price,
      })
    } else {
      set({
        items: [...items, { ...item, quantity: 1 }],
        totalItems: get().totalItems + 1,
        totalPrice: get().totalPrice + item.price,
      })
    }
  },

  removeItem: (id) => {
    const { items } = get()
    const item = items.find((i) => i.id === id)
    if (item) {
      set({
        items: items.filter((i) => i.id !== id),
        totalItems: get().totalItems - item.quantity,
        totalPrice: get().totalPrice - item.price * item.quantity,
      })
    }
  },

  updateQuantity: (id, quantity) => {
    const { items } = get()
    const item = items.find((i) => i.id === id)
    if (item) {
      const diff = quantity - item.quantity
      set({
        items: items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        totalItems: get().totalItems + diff,
        totalPrice: get().totalPrice + item.price * diff,
      })
    }
  },

  clearCart: () => {
    set({
      items: [],
      totalItems: 0,
      totalPrice: 0,
    })
  },
}))
