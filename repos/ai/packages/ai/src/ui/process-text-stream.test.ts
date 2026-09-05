import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { processTextStream } from './process-text-stream';
import { describe, it, expect, vi } from 'vitest';

describe('processTextStream', () => {
  it('should process stream chunks correctly', async () => {
    // Mock data
    const testData = ['Hello', ' ', 'World'];
    const chunks: string[] = [];

    // Create stream using utility
    const encoder = new TextEncoder();
    const stream = convertArrayToReadableStream(
      testData.map(chunk => encoder.encode(chunk)),
    );

    // Mock callback function
    const onChunk = vi.fn((chunk: string) => {
      chunks.push(chunk);
    });

    // Process the stream
    await processTextStream({ stream, onTextPart: onChunk });

    // Verify the results
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(chunks).toEqual(testData);
  });

  it('should handle empty streams', async () => {
    const onChunk = vi.fn();
    const stream = convertArrayToReadableStream<Uint8Array>([]);

    await processTextStream({ stream, onTextPart: onChunk });

    expect(onChunk).not.toHaveBeenCalled();
  });
});
