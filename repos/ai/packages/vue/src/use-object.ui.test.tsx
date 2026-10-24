import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { cleanup, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestComponent } from './setup-test-component';
import TestUseObjectComponent from './TestUseObjectComponent.vue';
import TestUseObjectCustomTransportComponent from './TestUseObjectCustomTransportComponent.vue';

const server = createTestServer({
  '/api/use-object': {},
});

describe('text stream', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe('basic component', () => {
    setupTestComponent(TestUseObjectComponent);

    describe("when the API returns 'Hello, world!'", () => {
      beforeEach(async () => {
        server.urls['/api/use-object'].response = {
          type: 'stream-chunks',
          chunks: ['{ ', '"content": "Hello, ', 'world', '!"'],
        };
        await userEvent.click(screen.getByTestId('submit-button'));
      });

      it('should render stream', async () => {
        await screen.findByTestId('object');
        expect(screen.getByTestId('object')).toHaveTextContent(
          JSON.stringify({ content: 'Hello, world!' }),
        );
      });

      it("should send 'test' to the API", async () => {
        expect(await server.calls[0].requestBodyJson).toBe('test-input');
      });

      it('should not have an error', async () => {
        await screen.findByTestId('error');
        expect(screen.getByTestId('error')).toBeEmptyDOMElement();
        expect(screen.getByTestId('on-error-result')).toBeEmptyDOMElement();
      });
    });

    describe('isLoading', () => {
      it('should be true while loading', async () => {
        const controller = new TestResponseController();
        server.urls['/api/use-object'].response = {
          type: 'controlled-stream',
          controller,
        };

        controller.write('{"content": ');
        await userEvent.click(screen.getByTestId('submit-button'));

        // wait for element "loading" to have text content "true":
        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('true');
        });

        controller.write('"Hello, world!"}');
        controller.close();

        // wait for element "loading" to have text content "false":
        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
      });
    });

    it('should abort the stream and not consume any more data', async () => {
      const controller = new TestResponseController();
      server.urls['/api/use-object'].response = {
        type: 'controlled-stream',
        controller,
      };

      controller.write('{"content": "h');
      await userEvent.click(screen.getByTestId('submit-button'));

      // wait for element "loading" and "object" to have text content:
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
      });
      await waitFor(() => {
        expect(screen.getByTestId('object')).toHaveTextContent(
          '{"content":"h"}',
        );
      });

      // click stop button:
      await userEvent.click(screen.getByTestId('stop-button'));

      // wait for element "loading" to have text content "false":
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // this should not be consumed any more:
      await expect(controller.write('ello, world!"}')).rejects.toThrow();
      await expect(controller.close()).rejects.toThrow();

      // should only show start of object:
      await waitFor(() => {
        expect(screen.getByTestId('object')).toHaveTextContent(
          '{"content":"h"}',
        );
      });
    });

    it('should stop and clear the object state after a call to submit then clear', async () => {
      const controller = new TestResponseController();
      server.urls['/api/use-object'].response = {
        type: 'controlled-stream',
        controller,
      };

      controller.write('{"content": "h');
      await userEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
      });
      await waitFor(() => {
        expect(screen.getByTestId('object')).toHaveTextContent(
          '{"content":"h"}',
        );
      });

      await userEvent.click(screen.getByTestId('clear-button'));

      await expect(controller.write('ello, world!"}')).rejects.toThrow();
      await expect(controller.close()).rejects.toThrow();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('error')).toBeEmptyDOMElement();
        expect(screen.getByTestId('object')).toBeEmptyDOMElement();
      });
    });

    describe('when the API returns a 404', () => {
      it('should render error', async () => {
        server.urls['/api/use-object'].response = {
          type: 'error',
          status: 404,
          body: 'Not found',
        };

        await userEvent.click(screen.getByTestId('submit-button'));

        await screen.findByTestId('error');
        expect(screen.getByTestId('error')).toHaveTextContent('Not found');
        expect(screen.getByTestId('on-error-result')).toHaveTextContent(
          'Not found',
        );
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    describe('onFinish', () => {
      it('should be called with an object when the stream finishes and the object matches the schema', async () => {
        server.urls['/api/use-object'].response = {
          type: 'stream-chunks',
          chunks: ['{ ', '"content": "Hello, ', 'world', '!"', '}'],
        };

        await userEvent.click(screen.getByTestId('submit-button'));

        expect(screen.getByTestId('on-finish-calls')).toHaveTextContent(
          JSON.stringify([
            { object: { content: 'Hello, world!' }, error: undefined },
          ]),
        );
      });

      it('should be called with an error when the stream finishes and the object does not match the schema', async () => {
        server.urls['/api/use-object'].response = {
          type: 'stream-chunks',
          chunks: ['{ ', '"content-wrong": "Hello, ', 'world', '!"', '}'],
        };

        await userEvent.click(screen.getByTestId('submit-button'));

        expect(screen.getByTestId('on-finish-calls')).toHaveTextContent(
          'ZodError',
        );
      });
    });

    it('should clear the object state after a call to clear', async () => {
      server.urls['/api/use-object'].response = {
        type: 'stream-chunks',
        chunks: ['{ ', '"content": "Hello, ', 'world', '!"', '}'],
      };

      await userEvent.click(screen.getByTestId('submit-button'));

      await screen.findByTestId('object');
      expect(screen.getByTestId('object')).toHaveTextContent(
        JSON.stringify({ content: 'Hello, world!' }),
      );

      await userEvent.click(screen.getByTestId('clear-button'));

      await waitFor(() => {
        expect(screen.getByTestId('object')).toBeEmptyDOMElement();
        expect(screen.getByTestId('error')).toBeEmptyDOMElement();
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('custom transport', () => {
    setupTestComponent(TestUseObjectCustomTransportComponent);

    it('should send custom headers', async () => {
      server.urls['/api/use-object'].response = {
        type: 'stream-chunks',
        chunks: ['{ ', '"content": "Hello, ', 'world', '!"', '}'],
      };

      await userEvent.click(screen.getByTestId('submit-button'));

      expect(server.calls[0].requestHeaders).toStrictEqual({
        'content-type': 'application/json',
        authorization: 'Bearer TEST_TOKEN',
        'x-custom-header': 'CustomValue',
      });
    });

    it('should send custom credentials', async () => {
      server.urls['/api/use-object'].response = {
        type: 'stream-chunks',
        chunks: ['{ ', '"content": "Authenticated ', 'content', '!"', '}'],
      };

      await userEvent.click(screen.getByTestId('submit-button'));
      expect(server.calls[0].requestCredentials).toBe('include');
    });
  });
});
