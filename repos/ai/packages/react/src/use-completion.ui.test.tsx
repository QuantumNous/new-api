import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UIMessageChunk } from 'ai';
import { setupTestComponent } from './setup-test-component';
import { useCompletion } from './use-completion';
import { describe, it, expect, beforeEach } from 'vitest';

function formatChunk(part: UIMessageChunk) {
  return `data: ${JSON.stringify(part)}\n\n`;
}

const server = createTestServer({
  '/api/completion': {},
});

describe('stream data stream', () => {
  let onFinishResult: { prompt: string; completion: string } | undefined;

  setupTestComponent(() => {
    const {
      completion,
      handleSubmit,
      error,
      handleInputChange,
      input,
      isLoading,
    } = useCompletion({
      onFinish(prompt, completion) {
        onFinishResult = { prompt, completion };
      },
    });

    return (
      <div>
        <div data-testid="loading">{isLoading.toString()}</div>
        <div data-testid="error">{error?.toString()}</div>
        <div data-testid="completion">{completion}</div>
        <form onSubmit={handleSubmit}>
          <input
            data-testid="input"
            value={input}
            placeholder="Say something..."
            onChange={handleInputChange}
          />
        </form>
      </div>
    );
  });

  beforeEach(() => {
    onFinishResult = undefined;
  });

  describe('render simple stream', () => {
    beforeEach(async () => {
      server.urls['/api/completion'].response = {
        type: 'stream-chunks',
        chunks: [
          formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
          formatChunk({ type: 'text-delta', id: '0', delta: ',' }),
          formatChunk({ type: 'text-delta', id: '0', delta: ' world' }),
          formatChunk({ type: 'text-delta', id: '0', delta: '.' }),
        ],
      };
      await userEvent.type(screen.getByTestId('input'), 'hi{enter}');
    });

    it('should render stream', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('completion')).toHaveTextContent(
          'Hello, world.',
        );
      });
    });

    it("should call 'onFinish' callback", async () => {
      await waitFor(() => {
        expect(onFinishResult).toEqual({
          prompt: 'hi',
          completion: 'Hello, world.',
        });
      });
    });
  });

  describe('loading state', () => {
    it('should show loading state', async () => {
      const controller = new TestResponseController();

      server.urls['/api/completion'].response = {
        type: 'controlled-stream',
        controller,
      };

      await userEvent.type(screen.getByTestId('input'), 'hi{enter}');

      controller.write(
        formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
      });

      await controller.close();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('should reset loading state on error', async () => {
      server.urls['/api/completion'].response = {
        type: 'error',
        status: 404,
        body: 'Not found',
      };

      await userEvent.type(screen.getByTestId('input'), 'hi{enter}');

      await screen.findByTestId('loading');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });
});

describe('text stream', () => {
  setupTestComponent(() => {
    const { completion, handleSubmit, handleInputChange, input } =
      useCompletion({ streamProtocol: 'text' });

    return (
      <div>
        <div data-testid="completion-text-stream">{completion}</div>
        <form onSubmit={handleSubmit}>
          <input
            data-testid="input-text-stream"
            value={input}
            placeholder="Say something..."
            onChange={handleInputChange}
          />
        </form>
      </div>
    );
  });

  it('should render stream', async () => {
    server.urls['/api/completion'].response = {
      type: 'stream-chunks',
      chunks: ['Hello', ',', ' world', '.'],
    };

    await userEvent.type(screen.getByTestId('input-text-stream'), 'hi{enter}');

    await screen.findByTestId('completion-text-stream');
    expect(screen.getByTestId('completion-text-stream')).toHaveTextContent(
      'Hello, world.',
    );
  });
});
