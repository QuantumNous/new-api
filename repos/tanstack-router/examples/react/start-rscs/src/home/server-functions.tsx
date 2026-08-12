import { createServerFn } from '@tanstack/react-start'
import { createCompositeComponent } from '@tanstack/react-start/rsc'

export interface DemoInfo {
  title: string
  description: string
  path: string
  features: Array<string>
  color: string
}

const demos: Array<DemoInfo> = [
  {
    title: 'eCommerce Composite Demo',
    description:
      'A product page built with composite server components. Shows how to combine server-rendered layouts with client-interactive elements like add-to-cart buttons and carousels.',
    path: '/e-commerce',
    features: [
      'Composite RSC pattern',
      'Zustand cart state',
      'Streaming comments',
      'Also bought carousel',
    ],
    color: 'from-purple-500 to-indigo-600',
  },
  {
    title: 'Pokemon RSC Demo',
    description:
      'Demonstrates async server components that fetch their own data. The Pokemon list is fetched and rendered entirely on the server.',
    path: '/pokemon-rsc',
    features: [
      'Async server components',
      'Server-side data fetching',
      'renderServerComponent API',
    ],
    color: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Low-Level RSC API Demo',
    description:
      "Explore TanStack Start's low-level Flight stream APIs including renderToReadableStream, createFromReadableStream, and createFromFetch.",
    path: '/low-level-api',
    features: [
      'Direct Flight streams',
      'Parallel streaming',
      'Nested Suspense',
      'IndexedDB caching',
      'HTTP streaming ticker',
    ],
    color: 'from-cyan-500 to-blue-600',
  },
]

// Server function to get the home page composite
export const getHomePage = createServerFn().handler(async () => {
  console.log('[Server] Rendering HomePage composite')

  const src = await createCompositeComponent(
    (props: {
      renderDemoCard?: (data: { demo: DemoInfo }) => React.ReactNode
    }) => (
      <div className="py-10">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              React Server Components Examples
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore different patterns and APIs for building applications with
              React Server Components in TanStack Start.
            </p>
          </div>

          {/* Demo Cards */}
          <div className="space-y-6">
            {demos.map((demo) => (
              <div key={demo.path}>{props.renderDemoCard?.({ demo })}</div>
            ))}
          </div>

          {/* Quick Info */}
          <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-3">
              About These Examples
            </h3>
            <p className="text-gray-600 text-sm">
              These examples demonstrate various React Server Component patterns
              available in TanStack Start. Server components are rendered on the
              server and sent to the client as a Flight stream. Client
              components handle interactivity and state management. The visual
              indicators in the footer show which parts are server-rendered
              (blue) vs client-interactive (green).
            </p>
          </div>
        </div>
      </div>
    ),
  )

  return { src }
})
