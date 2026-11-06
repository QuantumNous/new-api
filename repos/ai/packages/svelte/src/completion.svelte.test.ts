import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { render } from '@testing-library/svelte';
import type { UIMessageChunk } from 'ai';
import { Completion } from './completion.svelte.js';
import CompletionSynchronization from './tests/completion-synchronization.svelte';
import { describe, it, expect, vi } from 'vitest';

function formatChunk(part: UIMessageChunk) {
  return `data: ${JSON.stringify(part)}\n\n`;
}

const server = createTestServer({
  '/api/completion': {},
});

describe('Completion', () => {
  it('should render a data stream', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
      ],
    };

    const completion = new Completion();
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
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
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
          formatChunk({ type: 'text-start', id: '0' }),
          formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
          formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
          formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
          formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
          formatChunk({ type: 'text-end', id: '0' }),
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

describe('synchronization', () => {
  it('correctly synchronizes content between hook instances', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: [
        formatChunk({ type: 'text-start', id: '0' }),
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
        formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
        formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        formatChunk({ type: 'text-end', id: '0' }),
      ],
    };

    const {
      component: { completion1, completion2 },
    } = render(CompletionSynchronization, { id: crypto.randomUUID() });

    await completion1.complete('hi');

    expect(completion1.completion).toBe('Hello, world.');
    expect(completion2.completion).toBe('Hello, world.');
  });

  it('correctly synchronizes loading and error state between hook instances', async () => {
    const controller = new TestResponseController();
    server.urls['/api/completion'].response = {
      type: 'controlled-stream',
      controller,
    };

    const {
      component: { completion1, completion2 },
    } = render(CompletionSynchronization, { id: crypto.randomUUID() });

    const completionOperation = completion1.complete('hi');

    await vi.waitFor(() => {
      expect(completion1.loading).toBe(true);
      expect(completion2.loading).toBe(true);
    });

    controller.write(formatChunk({ type: 'text-start', id: '0' }));
    controller.write(
      formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
    );
    controller.write(formatChunk({ type: 'text-end', id: '0' }));
    await vi.waitFor(() => {
      expect(completion1.completion).toBe('Hello');
      expect(completion2.completion).toBe('Hello');
    });

    controller.error(new Error('Failed to be cool enough'));
    await completionOperation;

    expect(completion1.loading).toBe(false);
    expect(completion2.loading).toBe(false);
    expect(completion1.error).toBeInstanceOf(Error);
    expect(completion1.error?.message).toBe('Failed to be cool enough');
    expect(completion2.error).toBeInstanceOf(Error);
    expect(completion2.error?.message).toBe('Failed to be cool enough');
  });
});
