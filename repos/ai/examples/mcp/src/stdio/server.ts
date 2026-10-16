import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const POKE_API_BASE = 'https://pokeapi.co/api/v2';

const server = new McpServer({
  name: 'pokemon',
  version: '1.0.0',
});

server.tool(
  'get-pokemon',
  'Get Pokemon details by name',
  {
    name: z.string(),
  },
  async ({ name }) => {
    const path = `/pokemon/${name.toLowerCase()}`;
    const pokemon = await makePokeApiRequest<Pokemon>(path);

    if (!pokemon) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to retrieve Pokemon data',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: formatPokemonData(pokemon),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Pokemon MCP Server running on stdio');
}

main().catch(error => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

interface PokemonAbility {
  id: string;
  name: string;
}

interface Pokemon {
  id: string;
  name: string;
  abilities: { ability: PokemonAbility }[];
}

async function makePokeApiRequest<T>(path: string): Promise<T | null> {
  try {
    const url = `${POKE_API_BASE}${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error('[ERROR] Failed to make PokeAPI request:', error);
    return null;
  }
}

function formatPokemonData(pokemon: Pokemon) {
  return [
    `Name: ${pokemon.name}`,
    `Abilities: ${pokemon.abilities
      .map(ability => ability.ability.name)
      .join(', ')}`,
  ].join('\n');
}
