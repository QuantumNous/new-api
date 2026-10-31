import {
  convertArrayToAsyncIterable,
  convertReadableStreamToArray,
} from 'ai/test';
import { toUIMessageStream } from './llamaindex-adapter';
import { describe, it, expect } from 'vitest';

describe('toUIMessageStream', () => {
  it('should convert AsyncIterable<EngineResponse>', async () => {
    const inputStream = convertArrayToAsyncIterable([
      { delta: 'Hello' },
      { delta: 'World' },
    ]);

    expect(await convertReadableStreamToArray(toUIMessageStream(inputStream)))
      .toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "delta": "Hello",
            "id": "1",
            "type": "text-delta",
          },
          {
            "delta": "World",
            "id": "1",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
  });
});
