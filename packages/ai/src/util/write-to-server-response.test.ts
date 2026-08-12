import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeToServerResponse } from './write-to-server-response';
import { createMockServerResponse } from '../test/mock-server-response';

describe('writeToServerResponse', () => {
  it('should write data to ServerResponse', async () => {
    const mockResponse = createMockServerResponse();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk1'));
        controller.enqueue(new TextEncoder().encode('chunk2'));
        controller.close();
      },
    });

    writeToServerResponse({
      response: mockResponse,
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/plain' },
      stream,
    });

    await mockResponse.waitForEnd();

    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.statusMessage).toBe('OK');
    expect(mockResponse.writtenChunks).toHaveLength(2);
    expect(mockResponse.ended).toBe(true);
  });

  describe('backpressure handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should respect backpressure and wait for drain event', async () => {
      const mockResponse = createBackpressureMockResponse();
      let drainEventCount = 0;
      let readyToEnqueue: ((value: unknown) => void) | null = null;

      // Track drain events
      mockResponse.on('drain', () => {
        drainEventCount++;
      });

      // Create stream that provides chunks on-demand (async)
      const stream = new ReadableStream({
        start(controller) {
          // First chunk available immediately
          controller.enqueue(new TextEncoder().encode('chunk1'));
          // Set up callback for additional chunks
          readyToEnqueue = value => {
            if (value === null) {
              controller.close();
            } else {
              controller.enqueue(value as Uint8Array);
            }
          };
        },
      });

      writeToServerResponse({
        response: mockResponse,
        status: 200,
        stream,
      });

      // Wait for first chunk to be written
      await vi.advanceTimersByTimeAsync(10);
      expect(mockResponse.writeCallCount).toBe(1);

      // Enqueue second chunk - it should trigger write which returns false (backpressure)
      readyToEnqueue!(new TextEncoder().encode('chunk2'));
      await vi.advanceTimersByTimeAsync(5);

      // Second chunk write should have been called but returned false
      expect(mockResponse.writeCallCount).toBe(2);
      expect(mockResponse.writtenChunks.length).toBe(2);

      // Enqueue third chunk - it should NOT trigger write yet (still waiting for drain from chunk 2)
      readyToEnqueue!(new TextEncoder().encode('chunk3'));
      await vi.advanceTimersByTimeAsync(5);

      // Third chunk shouldn't be written yet (waiting for drain)
      expect(mockResponse.writeCallCount).toBe(2);

      // Simulate drain to allow third write
      mockResponse.simulateDrain();
      await vi.advanceTimersByTimeAsync(10);
      expect(mockResponse.writeCallCount).toBe(3);

      // Close the stream
      readyToEnqueue!(null);
      await vi.runAllTimersAsync();

      expect(mockResponse.ended).toBe(true);

      // Verify that drain was called (indicating backpressure was respected)
      expect(drainEventCount).toBeGreaterThanOrEqual(1);
      // Verify all chunks were eventually written
      expect(mockResponse.writtenChunks).toHaveLength(3);
    });
  });

  it('should set headers correctly when statusText is undefined', async () => {
    const mockResponse = createMockServerResponse();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test data'));
        controller.close();
      },
    });

    const expectedHeaders = {
      'X-Example-Header': 'example-value',
      'X-Example-Chat-Title': 'My Conversation',
    };

    writeToServerResponse({
      response: mockResponse,
      status: 200,
      statusText: undefined,
      headers: expectedHeaders,
      stream,
    });

    await mockResponse.waitForEnd();

    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.headers).toEqual(expectedHeaders);
    expect(mockResponse.ended).toBe(true);
    expect(mockResponse.writtenChunks).toHaveLength(1);
  });

  it('should set headers correctly when statusText is provided', async () => {
    const mockResponse = createMockServerResponse();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test data'));
        controller.close();
      },
    });

    const expectedHeaders = {
      'X-Example-Header': 'example-value',
      'X-Example-Chat-Title': 'New Chat Session',
    };

    writeToServerResponse({
      response: mockResponse,
      status: 201,
      statusText: 'Created',
      headers: expectedHeaders,
      stream,
    });

    await mockResponse.waitForEnd();

    expect(mockResponse.statusCode).toBe(201);
    expect(mockResponse.statusMessage).toBe('Created');
    expect(mockResponse.headers).toEqual(expectedHeaders);
    expect(mockResponse.ended).toBe(true);
    expect(mockResponse.writtenChunks).toHaveLength(1);
  });

  it('should set headers correctly when statusText is not set and status is not set', async () => {
    const mockResponse = createMockServerResponse();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test data'));
        controller.close();
      },
    });

    const expectedHeaders = {
      'X-Example-Header': 'example-value',
      'X-Example-Message': 'Hello World',
    };

    writeToServerResponse({
      response: mockResponse,
      headers: expectedHeaders,
      stream,
    });

    await mockResponse.waitForEnd();

    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.headers).toEqual(expectedHeaders);
    expect(mockResponse.ended).toBe(true);
    expect(mockResponse.writtenChunks).toHaveLength(1);
  });
});

class BackpressureMockResponse extends EventEmitter {
  writtenChunks: any[] = [];
  writeCallCount = 0;
  statusCode = 0;
  statusMessage = '';
  headers: Record<string, string | number | string[]> | undefined;
  ended = false;
  private shouldApplyBackpressure = false;

  write(chunk: any): boolean {
    this.writtenChunks.push(chunk);
    this.writeCallCount++;

    // First write succeeds, subsequent writes signal backpressure
    if (this.writeCallCount === 1) {
      this.shouldApplyBackpressure = true;
      return true; // First write is okay
    }

    // If we're in backpressure mode, return false
    if (this.shouldApplyBackpressure) {
      return false;
    }

    // After drain, this write succeeds, but next will need drain again
    this.shouldApplyBackpressure = true;
    return true;
  }

  simulateDrain(): void {
    this.shouldApplyBackpressure = false;
    this.emit('drain');
  }

  end(): void {
    this.ended = true;
  }

  writeHead(
    statusCode: number,
    statusMessage?: string,
    headers?: Record<string, string | number | string[]>,
  ): void {
    this.statusCode = statusCode;

    if (typeof statusMessage === 'string') {
      this.statusMessage = statusMessage;
      this.headers = headers;
    } else {
      this.statusMessage = '';
      this.headers = statusMessage;
    }
  }

  async waitForEnd() {
    await new Promise(resolve => {
      const checkIfEnded = () => {
        if (this.ended) {
          resolve(undefined);
        } else {
          setImmediate(checkIfEnded);
        }
      };
      checkIfEnded();
    });
  }
}

function createBackpressureMockResponse(): ServerResponse &
  BackpressureMockResponse {
  return new BackpressureMockResponse() as ServerResponse &
    BackpressureMockResponse;
}
