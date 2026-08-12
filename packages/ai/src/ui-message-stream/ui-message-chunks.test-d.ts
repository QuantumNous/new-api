import { describe, expectTypeOf, it } from 'vitest';
import { uiMessageChunkSchema, type UIMessageChunk } from './ui-message-chunks';
import { validateTypes } from '@ai-sdk/provider-utils';

describe('UI message chunks type', () => {
  it('parsed UI message chunk should have UIMessageChunk type', async () => {
    const chunk = await validateTypes({
      schema: uiMessageChunkSchema,
      value: {
        type: 'text-delta',
        delta: 'Hello, world!',
        id: '123',
      },
    });

    expectTypeOf(chunk).toEqualTypeOf<UIMessageChunk>();
  });
});
