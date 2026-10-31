import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import { toTextStream } from './to-text-stream';

describe('toTextStream', () => {
  it('keeps only text deltas', async () => {
    const stream = toTextStream({
      stream: convertArrayToReadableStream([
        { type: 'start' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', text: 'Hello' },
        { type: 'text-delta', id: 't1', text: ', world!' },
        { type: 'text-end', id: 't1' },
      ] satisfies TextStreamPart<{}>[]),
    });

    await expect(convertReadableStreamToArray(stream)).resolves.toStrictEqual([
      'Hello',
      ', world!',
    ]);
  });
});
