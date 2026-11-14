import { tool } from 'ai';
import { z } from 'zod';

export const rollDieToolWithProgrammaticCalling = tool({
  description: 'Roll a die and return the result.',
  inputSchema: z.object({
    player: z.enum(['player1', 'player2']),
  }),
  providerOptions: {
    anthropic: {
      allowedCallers: ['code_execution_20260120'],
    },
  },
  execute: async ({ player }) => {
    if (player === 'player1') {
      // Simulate a loaded die that slightly skews towards 6
      const r = Math.random();
      if (r < 0.13) return { roll: 1 };
      if (r < 0.26) return { roll: 2 };
      if (r < 0.39) return { roll: 3 };
      if (r < 0.52) return { roll: 4 };
      if (r < 0.65) return { roll: 5 };
      return { roll: 6 };
    } else {
      return { roll: Math.floor(Math.random() * 6) + 1 };
    }
  },
});
