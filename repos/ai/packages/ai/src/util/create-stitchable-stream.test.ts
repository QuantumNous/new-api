import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { describe, it, expect } from 'vitest';
import { createStitchableStream } from './create-stitchable-stream';

describe('createStitchableStream', () => {
  describe('read full streams after they are added', () => {
    it('should return no stream when immediately closed', async () => {
      const { stream, close } = createStitchableStream<number>();

      close();

      expect(await convertReadableStreamToArray(stream)).toEqual([]);
    });

    it('should return all values from a single inner stream', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      addStream(convertArrayToReadableStream([1, 2, 3]));
      close();

      expect(await convertReadableStreamToArray(stream)).toEqual([1, 2, 3]);
    });

    it('should return all values from 2 inner streams', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      addStream(convertArrayToReadableStream([1, 2, 3]));
      addStream(convertArrayToReadableStream([4, 5, 6]));
      close();

      expect(await convertReadableStreamToArray(stream)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
    });

    it('should return all values from 3 inner streams', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      addStream(convertArrayToReadableStream([1, 2, 3]));
      addStream(convertArrayToReadableStream([4, 5, 6]));
      addStream(convertArrayToReadableStream([7, 8, 9]));
      close();

      expect(await convertReadableStreamToArray(stream)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    });

    it('should handle empty inner streams', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      addStream(convertArrayToReadableStream([]));
      addStream(convertArrayToReadableStream([1, 2]));
      addStream(convertArrayToReadableStream([]));
      addStream(convertArrayToReadableStream([3, 4]));
      close();

      expect(await convertReadableStreamToArray(stream)).toEqual([1, 2, 3, 4]);
    });

    it('should handle reading a single value before it is added', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      // Start reading before any values are added
      const reader = stream.getReader();
      const readPromise = reader.read();

      // Add value with delay after starting read
      Promise.resolve().then(() => {
        addStream(convertArrayToReadableStream([42]));
        close();
      });

      // Value should be returned once available
      expect(await readPromise).toEqual({ done: false, value: 42 });

      // Stream should complete after value is read
      expect(await reader.read()).toEqual({ done: true, value: undefined });
    });
  });

  describe('read from partial stream and with interruptions', async () => {
    it('should return all values from 2 inner streams', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      // read 5 values from the stream before they are added
      // (added asynchronously)
      const reader = stream.getReader();
      const results: Array<{ done: boolean; value?: number }> = [];
      for (let i = 0; i < 5; i++) {
        reader.read().then(result => {
          results.push(result);
        });
      }

      addStream(convertArrayToReadableStream([1, 2, 3]));
      addStream(convertArrayToReadableStream([4, 5]));
      close();

      // wait for the stream to finish via await:
      expect(await reader.read()).toEqual({ done: true, value: undefined });

      expect(results).toEqual([
        { done: false, value: 1 },
        { done: false, value: 2 },
        { done: false, value: 3 },
        { done: false, value: 4 },
        { done: false, value: 5 },
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle errors from inner streams', async () => {
      const { stream, addStream, close } = createStitchableStream<number>();

      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Test error'));
        },
      });

      addStream(convertArrayToReadableStream([1, 2]));
      addStream(errorStream);
      addStream(convertArrayToReadableStream([3, 4]));
      close();

      await expect(convertReadableStreamToArray(stream)).rejects.toThrow(
        'Test error',
      );
    });
  });

  describe('cancellation & closing', () => {
    it('should cancel all inner streams when cancelled', async () => {
      const { stream, addStream } = createStitchableStream<number>();

      let stream1Cancelled = false;
      let stream2Cancelled = false;

      const mockStream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
        },
        cancel() {
          stream1Cancelled = true;
        },
      });

      const mockStream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(3);
          controller.enqueue(4);
        },
        cancel() {
          stream2Cancelled = true;
        },
      });

      addStream(mockStream1);
      addStream(mockStream2);

      await stream.cancel();

      expect(stream1Cancelled).toBe(true);
      expect(stream2Cancelled).toBe(true);
    });

    it('should throw an error when adding a stream after closing', async () => {
      const { addStream, close } = createStitchableStream<number>();

      close();

      expect(() => addStream(convertArrayToReadableStream([1, 2]))).toThrow(
        'Cannot add inner stream: outer stream is closed',
      );
    });
  });

  describe('terminate', () => {
    it('should immediately close the stream and cancel all inner streams', async () => {
      const { stream, addStream, terminate } = createStitchableStream<number>();

      let stream1Cancelled = false;
      let stream2Cancelled = false;

      const mockStream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
        },
        cancel() {
          stream1Cancelled = true;
        },
      });

      const mockStream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(3);
          controller.enqueue(4);
        },
        cancel() {
          stream2Cancelled = true;
        },
      });

      addStream(mockStream1);
      addStream(mockStream2);

      // Start reading from the stream
      const reader = stream.getReader();
      const firstRead = await reader.read();

      terminate();

      // Should immediately close without reading remaining values
      const finalRead = await reader.read();

      expect(firstRead).toEqual({ done: false, value: 1 });
      expect(finalRead).toEqual({ done: true, value: undefined });
      expect(stream1Cancelled).toBe(true);
      expect(stream2Cancelled).toBe(true);
    });

    it('should throw an error when adding a stream after terminating', async () => {
      const { addStream, terminate } = createStitchableStream<number>();

      terminate();

      expect(() => addStream(convertArrayToReadableStream([1, 2]))).toThrow(
        'Cannot add inner stream: outer stream is closed',
      );
    });
  });
});
