import { tool } from 'ai';

export const weather = tool({
  inputSchema: {} as any,
  execute: async (input, { experimental_context }: any) => {
    return experimental_context;
  },
});
