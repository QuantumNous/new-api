import { Link, createFileRoute } from '@tanstack/react-router'
import { getPokemonList } from '~/pokemon/server-functions'

export const Route = createFileRoute('/pokemon-rsc')({
  loader: async () => {
    const { Renderable } = await getPokemonList()
    return Renderable
  },
  component: PokemonPage,
})

function PokemonPage() {
  const PokemonList = Route.useLoaderData()

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Comparison Link */}
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-indigo-800 text-sm">
              <strong>Compare:</strong> See how this RSC version differs from
              the traditional SSR approach in structure and payload size.
            </p>
          </div>
          <Link
            to="/pokemon"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap ml-4"
          >
            View Traditional Version
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>

        {/* Pokemon List - Server Component */}
        <section>{PokemonList}</section>
      </div>
    </div>
  )
}
