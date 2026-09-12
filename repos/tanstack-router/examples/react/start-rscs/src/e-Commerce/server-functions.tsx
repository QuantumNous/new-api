import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  renderToReadableStream,
} from '@tanstack/react-start/rsc'

// ============================================
// Product Data & Types
// ============================================

export interface Product {
  id: string
  name: string
  price: number
  description: string
  image: string
}

export interface AlsoBoughtProduct {
  id: string
  name: string
  price: number
  image: string
}

// Main product
const mainProduct: Product = {
  id: 'tanstack-ukulele',
  name: 'TanStack Ukulele',
  price: 149.99,
  description:
    'Hand-crafted koa wood ukulele with mother-of-pearl TanStack inlay. Perfect for beach jams, campfire singalongs, or just strumming at your desk while waiting for builds to finish.',
  image: '/example-ukelele-tanstack.jpg',
}

// Also bought products
const alsoBoughtProducts: Array<AlsoBoughtProduct> = [
  {
    id: 'guitar-flowers',
    name: 'Floral Guitar',
    price: 299.99,
    image: '/example-guitar-flowers.jpg',
  },
  {
    id: 'guitar-motherboard',
    name: 'Circuit Guitar',
    price: 349.99,
    image: '/example-guitar-motherboard.jpg',
  },
  {
    id: 'guitar-racing',
    name: 'Racing Guitar',
    price: 279.99,
    image: '/example-guitar-racing.jpg',
  },
  {
    id: 'guitar-steamer-trunk',
    name: 'Vintage Guitar',
    price: 399.99,
    image: '/example-guitar-steamer-trunk.jpg',
  },
  {
    id: 'guitar-superhero',
    name: 'Hero Guitar',
    price: 329.99,
    image: '/example-guitar-superhero.jpg',
  },
]

// ============================================
// Product Page Server Function
// ============================================

export const getProductPage = createServerFn().handler(async () => {
  console.log('[Server] Rendering ProductPage composite')

  const src = await createCompositeComponent(
    (props: {
      children?: React.ReactNode
      renderAlsoBought?: (data: {
        products: Array<AlsoBoughtProduct>
      }) => React.ReactNode
    }) => (
      <div className="border-6 border-solid border-blue-500 rounded-xl p-6 bg-white shadow-lg">
        {/* Product Hero Section */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* Product Image */}
          <div className="md:w-1/2">
            <img
              src={mainProduct.image}
              alt={mainProduct.name}
              className="w-full rounded-lg shadow-md"
            />
          </div>

          {/* Product Details */}
          <div className="md:w-1/2 flex flex-col">
            <h1 className="text-3xl font-bold text-gray-900">
              {mainProduct.name}
            </h1>
            <p className="text-gray-600 mt-2">{mainProduct.description}</p>
            <p className="text-3xl font-bold text-gray-900 mt-4">
              ${mainProduct.price}
            </p>

            {/* CTA Slot (client component) */}
            <div className="mt-6">{props.children}</div>
          </div>
        </div>

        {/* Also Bought Section */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Customers who bought this also bought
          </h2>
          <div className="border-6 border-solid border-blue-500 rounded-lg p-4">
            {props.renderAlsoBought?.({ products: alsoBoughtProducts })}
          </div>
        </div>
      </div>
    ),
  )

  return { src }
})

// ============================================
// Streaming Comments
// ============================================

// Sample comments for streaming
const comments = [
  {
    author: 'MusicLover42',
    text: "Best ukulele I've ever owned! The tone is incredible and the TanStack inlay is gorgeous.",
    rating: 5,
  },
  {
    author: 'BeachVibes',
    text: 'Perfect for beach jams. Everyone asks where I got it!',
    rating: 5,
  },
  {
    author: 'UkeNewbie',
    text: 'As a beginner, this was the perfect first instrument. Great quality for the price.',
    rating: 5,
  },
  {
    author: 'DevMusician',
    text: 'I code with TanStack and play TanStack. Living the dream!',
    rating: 5,
  },
  {
    author: 'IslandDreamer',
    text: "The sound is so warm and rich. It's like Hawaii in a box!",
    rating: 5,
  },
  {
    author: 'GuitarConvert',
    text: 'Switched from guitar to uke because of this beauty. No regrets!',
    rating: 5,
  },
  {
    author: 'CampfireKing',
    text: 'This uke is the star of every campfire. Worth every penny.',
    rating: 4,
  },
  {
    author: 'TechStrummer',
    text: 'Finally, an instrument that understands my stack preferences!',
    rating: 5,
  },
]

// Server component for each comment
function CommentCard({
  author,
  text,
  rating,
  timestamp,
}: {
  author: string
  text: string
  rating: number
  timestamp: string
}) {
  const gradients = [
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-amber-500 to-orange-500',
    'from-pink-500 to-rose-500',
  ]
  const gradient = gradients[Math.floor(Math.random() * gradients.length)]

  return (
    <div
      className={`p-4 bg-linear-to-r ${gradient} rounded-lg text-white shadow-md border-4 border-solid border-blue-300`}
    >
      <div className="flex justify-between items-start">
        <div className="font-bold">{author}</div>
        <div className="flex gap-0.5">
          {Array.from({ length: rating }).map((_, i) => (
            <span key={i}>⭐</span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-white/90">{text}</p>
      <div className="text-xs opacity-70 mt-2 font-mono">
        Posted: {new Date(timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}

// Helper to convert stream to string
async function streamToString(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader()
  const chunks: Array<string> = []
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value, { stream: true }))
  }

  return chunks.join('')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Async generator that streams comment RSCs
export const streamComments = createServerFn().handler(async function* () {
  for (let i = 0; i < comments.length; i++) {
    await sleep(2000) // Wait 2 seconds between comments

    const comment = comments[i]
    console.log(`[Server] Rendering comment from ${comment.author}`)

    const stream = await renderToReadableStream(
      <CommentCard
        author={comment.author}
        text={comment.text}
        rating={comment.rating}
        timestamp={new Date().toISOString()}
      />,
    )

    const payload = await streamToString(stream)
    yield { id: i, payload }
  }
})
