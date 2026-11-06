import { Link, createFileRoute } from '@tanstack/react-router'
import type { PokemonDetails } from '~/pokemon/server-functions'
import { fetchPokemonData, typeColors } from '~/pokemon/server-functions'

export const Route = createFileRoute('/pokemon')({
  loader: async () => {
    // Traditional loader pattern - fetches data, returns JSON
    // This data is serialized to JSON and sent to the client
    // The component then renders it on the client
    const { pokemon } = await fetchPokemonData()
    return { pokemon }
  },
  component: PokemonPage,
})

function Button({ className, title }: { className?: string; title?: string }) {
  return (
    <button
      onClick={() => alert(`${title} clicked`)}
      type="button"
      className={`bg-blue-500 text-white px-4 py-2 rounded-md ${className}`}
    >
      {title}
    </button>
  )
}

function PokemonCard({ pokemon }: { pokemon: PokemonDetails }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center shadow-sm hover:shadow-md transition-shadow">
      <img
        src={pokemon.sprites.front_default}
        alt={pokemon.name}
        className="w-24 h-24 mx-auto"
      />
      <p className="font-semibold capitalize text-gray-800">{pokemon.name}</p>
      <p className="text-xs text-gray-500 mb-2">#{pokemon.id}</p>
      <div className="flex gap-1 justify-center flex-wrap">
        {pokemon.types.map((t) => (
          <Button
            key={t.type.name}
            className={typeColors[t.type.name] || 'bg-gray-500'}
            title={t.type.name}
          />
        ))}
      </div>
    </div>
  )
}

function PokemonPage() {
  const { pokemon } = Route.useLoaderData()

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pokemon (Traditional SSR)
          </h1>
          <p className="text-gray-600 mb-4">
            This list was fetched in the loader and rendered as a normal React
            component. The data is serialized to JSON and sent to the client,
            where the component re-renders with that data.
          </p>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              <strong>Note:</strong> Unlike the RSC version, this page sends the
              full Pokemon data as JSON in the initial HTML payload. The
              component code also ships to the client and re-hydrates. Check the
              Network tab to compare payload sizes!
            </p>
          </div>

          <Link
            to="/pokemon-rsc"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-6"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            View RSC Version
          </Link>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pokemon.map((p) => (
              <PokemonCard key={p.id} pokemon={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
