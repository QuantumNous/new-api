import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { Completion } from './completion.ng';

function formatStreamPart(part: object) {
  return `data: ${JSON.stringify(part)}\n\n`;
}

const server = createTestServer({
  '/api/completion': {},
});

describe('Completion', () => {
  it('initialises', () => {
    const completion = new Completion();
    expect(completion.api).toBe('/api/completion');
    expect(completion.completion).toBe('');
    expect(completion.input).toBe('');
    expect(completion.error).toBeUndefined();
    expect(completion.loading).toBe(false);
    expect(completion.id).toBeDefined();
  });

  it('should render a data stream', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: [
        formatStreamPart({ type: 'text-start', id: '0' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: ',' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: ' world' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: '.' }),
        formatStreamPart({ type: 'text-end', id: '0' }),
      ],
    };
    const completion = new Completion({
      api: '/api/completion',
    });
    await completion.complete('hi');
    expect(completion.completion).toBe('Hello, world.');
  });

  it('should render a text stream', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: ['Hello', ',', ' world', '.'],
    };

    const completion = new Completion({ streamProtocol: 'text' });
    await completion.complete('hi');
    expect(completion.completion).toBe('Hello, world.');
  });

  it('should call `onFinish` callback', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: [
        formatStreamPart({ type: 'text-start', id: '0' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: ',' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: ' world' }),
        formatStreamPart({ type: 'text-delta', id: '0', delta: '.' }),
        formatStreamPart({ type: 'text-end', id: '0' }),
      ],
    };

    const onFinish = vi.fn();
    const completion = new Completion({ onFinish });
    await completion.complete('hi');
    expect(onFinish).toHaveBeenCalledExactlyOnceWith('hi', 'Hello, world.');
  });

  it('should show loading state', async () => {
    const controller = new TestResponseController();
    server.urls['/api/completion'].response = {
      type: 'controlled-stream',
      controller,
    };

    const completion = new Completion();
    const completionOperation = completion.complete('hi');
    controller.write('0:"Hello"\n');
    await vi.waitFor(() => expect(completion.loading).toBe(true));
    controller.close();
    await completionOperation;
    expect(completion.loading).toBe(false);
  });

  describe('stop', () => {
    it('should abort the stream and not consume any more data', async () => {
      const controller = new TestResponseController();
      server.urls['/api/completion'].response = {
        type: 'controlled-stream',
        controller,
      };

      const completion = new Completion();
      const completionOperation = completion.complete('hi');
      controller.write(
        formatStreamPart({ type: 'text-delta', id: '0', delta: 'Hello' }),
      );

      await vi.waitFor(() => {
        expect(completion.loading).toBe(true);
        expect(completion.completion).toBe('Hello');
      });

      completion.stop();

      await vi.waitFor(() => expect(completion.loading).toBe(false));

      await expect(controller.write('0:", world"\n')).rejects.toThrow();
      await expect(controller.close()).rejects.toThrow();
      await completionOperation;

      expect(completion.loading).toBe(false);
      expect(completion.completion).toBe('Hello');
    });
  });

  it('should reset loading state on error', async () => {
    server.urls['/api/completion'].response = {
      type: 'error',
      status: 404,
      body: 'Not found',
    };

    const completion = new Completion();
    await completion.complete('hi');
    expect(completion.error).toBeInstanceOf(Error);
    expect(completion.loading).toBe(false);
  });

  it('should reset error state on subsequent completion', async () => {
    server.urls['/api/completion'].response = [
      {
        type: 'error',
        status: 404,
        body: 'Not found',
      },
      {
        type: 'stream-chunks',
        chunks: [
          formatStreamPart({ type: 'text-start', id: '0' }),
          formatStreamPart({ type: 'text-delta', id: '0', delta: 'Hello' }),
          formatStreamPart({ type: 'text-delta', id: '0', delta: ',' }),
          formatStreamPart({ type: 'text-delta', id: '0', delta: ' world' }),
          formatStreamPart({ type: 'text-delta', id: '0', delta: '.' }),
          formatStreamPart({ type: 'text-end', id: '0' }),
        ],
      },
    ];

    const completion = new Completion();
    await completion.complete('hi');
    expect(completion.error).toBeInstanceOf(Error);
    expect(completion.loading).toBe(false);
    await completion.complete('hi');
    expect(completion.error).toBe(undefined);
    expect(completion.completion).toBe('Hello, world.');
  });
});
