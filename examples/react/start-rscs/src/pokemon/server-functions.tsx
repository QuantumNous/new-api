import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { Button } from './Button'

// ============================================
// Pokemon RSC - Async Server Component Example
// ============================================

// Types for PokeAPI
export interface PokemonListItem {
  name: string
  url: string
}

export interface PokemonDetails {
  id: number
  name: string
  sprites: { front_default: string }
  types: Array<{ type: { name: string } }>
}

// Type color mapping for Pokemon type badges
export const typeColors: Record<string, string> = {
  normal: 'bg-gray-400',
  fire: 'bg-red-500',
  water: 'bg-blue-500',
  electric: 'bg-yellow-400',
  grass: 'bg-green-500',
  ice: 'bg-cyan-300',
  fighting: 'bg-orange-700',
  poison: 'bg-purple-500',
  ground: 'bg-amber-600',
  flying: 'bg-indigo-300',
  psychic: 'bg-pink-500',
  bug: 'bg-lime-500',
  rock: 'bg-stone-500',
  ghost: 'bg-purple-700',
  dragon: 'bg-indigo-600',
  dark: 'bg-gray-700',
  steel: 'bg-gray-400',
  fairy: 'bg-pink-300',
}

// Server component for individual Pokemon card
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

// Async Server Component - fetches its own data (like Next.js RSC)
async function PokemonList() {
  console.log('[Server] Fetching Pokemon data...')

  // Data fetching happens INSIDE the component
  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=20')
  const data = await response.json()

  // Fetch details for each Pokemon to get sprites and types
  const pokemonDetails = await Promise.all(
    data.results.map(async (pokemon: PokemonListItem) => {
      const res = await fetch(pokemon.url)
      return res.json() as Promise<PokemonDetails>
    }),
  )

  console.log(`[Server] Fetched ${pokemonDetails.length} Pokemon`)

  return (
    <div className="border-6 border-solid border-blue-500 rounded-xl p-6 bg-white shadow-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Pokemon (Server Component)
      </h1>
      <p className="text-gray-600 mb-6">
        This list was fetched and rendered entirely on the server using an async
        React component.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pokemonDetails.map((pokemon) => (
          <PokemonCard key={pokemon.id} pokemon={pokemon} />
        ))}
      </div>
    </div>
  )
}

// Server function that renders the async component
export const getPokemonList = createServerFn().handler(async () => {
  const Renderable = await renderServerComponent(<PokemonList />)
  return { Renderable }
})

// Server function that fetches Pokemon data (traditional SSR - no RSC)
export const fetchPokemonData = createServerFn().handler(async () => {
  console.log('[Server] Fetching Pokemon data (traditional loader)...')

  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=20')
  const data = await response.json()

  const pokemonDetails = await Promise.all(
    data.results.map(async (pokemon: PokemonListItem) => {
      const res = await fetch(pokemon.url)
      const { name, id, sprites, types } = await res.json()
      return {
        name,
        id,
        sprites: {
          front_default: sprites.front_default,
        },
        types: types.map(
          (t: { type: { name: string } }): { type: { name: string } } => ({
            type: { name: t.type.name },
          }),
        ),
      } as unknown as Promise<PokemonDetails>
    }),
  )

  console.log(`[Server] Fetched ${pokemonDetails.length} Pokemon (traditional)`)

  return { pokemon: pokemonDetails }
})
