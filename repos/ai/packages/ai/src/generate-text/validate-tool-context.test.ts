import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { TypeValidationError } from '../error';
import { validateToolContext } from './validate-tool-context';

describe('validateToolContext', () => {
  it('returns the tool context as-is when no context schema is defined', async () => {
    const toolContext = { apiKey: 123 };

    const result = await validateToolContext<typeof toolContext>({
      toolName: 'weather',
      context: toolContext,
      contextSchema: undefined,
    });

    expect(result).toBe(toolContext);
  });

  it('returns the validated tool context when the context schema matches', async () => {
    const result = await validateToolContext<{ apiKey: string }>({
      toolName: 'weather',
      context: { apiKey: 'secret' },
      contextSchema: z.object({ apiKey: z.string() }),
    });

    expect(result).toEqual({ apiKey: 'secret' });
  });

  it('throws TypeValidationError when the context schema validation fails', async () => {
    try {
      await validateToolContext<{ apiKey: string }>({
        toolName: 'weather',
        context: { apiKey: 123 },
        contextSchema: z.object({ apiKey: z.string() }),
      });

      expect.unreachable('expected validateToolContext to throw');
    } catch (error) {
      expect(TypeValidationError.isInstance(error)).toBe(true);

      if (TypeValidationError.isInstance(error)) {
        expect(error.value).toEqual({ apiKey: 123 });
        expect(error.context).toEqual({
          field: 'tool context',
          entityName: 'weather',
        });
      }
    }
  });
});
