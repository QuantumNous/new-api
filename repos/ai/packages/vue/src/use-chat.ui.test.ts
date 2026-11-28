import { mockId } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import type { UIMessageChunk } from 'ai';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { setupTestComponent } from './setup-test-component';
import { useChat } from './use-chat';

function formatChunk(part: UIMessageChunk) {
  return `data: ${JSON.stringify(part)}\n\n`;
}

const server = createTestServer({
  '/api/chat': {},
});

describe('useChat', () => {
  describe('initial messages', () => {
    setupTestComponent(
      defineComponent({
        setup() {
          const { messages } = useChat({
            messages: [
              {
                id: 'id-0',
                role: 'user',
                parts: [{ type: 'text', text: 'hi' }],
              },
            ],
          });
          return () =>
            h(
              'div',
              { 'data-testid': 'messages' },
              JSON.stringify(messages.value),
            );
        },
      }),
    );

    it('seeds messages from init', () => {
      expect(
        JSON.parse(screen.getByTestId('messages').textContent ?? ''),
      ).toStrictEqual([
        { id: 'id-0', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      ]);
    });
  });

  describe('data protocol stream', () => {
    setupTestComponent(
      defineComponent({
        setup() {
          const { messages, status, error, sendMessage } = useChat({
            generateId: mockId(),
          });
          return () =>
            h('div', [
              h('div', { 'data-testid': 'status' }, status.value),
              error.value
                ? h('div', { 'data-testid': 'error' }, error.value.toString())
                : null,
              h(
                'div',
                { 'data-testid': 'messages' },
                JSON.stringify(messages.value),
              ),
              h('button', {
                'data-testid': 'do-send',
                onClick: () => sendMessage({ text: 'hi' }),
              }),
            ]);
        },
      }),
    );

    it('streams an assistant response and ends in ready status', async () => {
      server.urls['/api/chat'].response = {
        type: 'stream-chunks',
        chunks: [
          formatChunk({ type: 'text-start', id: '0' }),
          formatChunk({ type: 'text-delta', id: '0', delta: 'Hello' }),
          formatChunk({ type: 'text-delta', id: '0', delta: ', world.' }),
          formatChunk({ type: 'text-end', id: '0' }),
        ],
      };

      await userEvent.click(screen.getByTestId('do-send'));

      await waitFor(() => {
        expect(
          JSON.parse(screen.getByTestId('messages').textContent ?? ''),
        ).toStrictEqual([
          {
            id: 'id-1',
            role: 'user',
            parts: [{ type: 'text', text: 'hi' }],
          },
          {
            id: 'id-2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Hello, world.', state: 'done' }],
          },
        ]);
      });
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    it('surfaces server errors and sets status to error', async () => {
      server.urls['/api/chat'].response = {
        type: 'error',
        status: 404,
        body: 'Not found',
      };

      await userEvent.click(screen.getByTestId('do-send'));

      await screen.findByTestId('error');
      expect(screen.getByTestId('error').textContent).toBe('Error: Not found');
      expect(screen.getByTestId('status').textContent).toBe('error');
    });
  });

  describe('reactive init', () => {
    setupTestComponent(
      defineComponent({
        setup() {
          const which = ref<'a' | 'b'>('a');
          const { messages, id } = useChat(() => ({
            id: which.value,
            messages:
              which.value === 'a'
                ? [
                    {
                      id: 'm-1',
                      role: 'user',
                      parts: [{ type: 'text', text: 'first' }],
                    },
                  ]
                : [],
          }));
          return () =>
            h('div', [
              h('div', { 'data-testid': 'id' }, id.value),
              h(
                'div',
                { 'data-testid': 'message-count' },
                String(messages.value.length),
              ),
              h('button', {
                'data-testid': 'swap',
                onClick: () => (which.value = 'b'),
              }),
            ]);
        },
      }),
    );

    it('recreates the chat and resets messages when init changes', async () => {
      expect(screen.getByTestId('id').textContent).toBe('a');
      expect(screen.getByTestId('message-count').textContent).toBe('1');

      await userEvent.click(screen.getByTestId('swap'));

      await waitFor(() => {
        expect(screen.getByTestId('id').textContent).toBe('b');
      });
      expect(screen.getByTestId('message-count').textContent).toBe('0');
    });
  });

  describe('clearError', () => {
    setupTestComponent(
      defineComponent({
        setup() {
          const { error, sendMessage, clearError } = useChat();
          return () =>
            h('div', [
              error.value
                ? h('div', { 'data-testid': 'error' }, error.value.toString())
                : null,
              h('button', {
                'data-testid': 'do-send',
                onClick: () => sendMessage({ text: 'hi' }),
              }),
              h('button', {
                'data-testid': 'do-clear',
                onClick: () => clearError(),
              }),
            ]);
        },
      }),
    );

    it('removes the error after clearError is called', async () => {
      server.urls['/api/chat'].response = {
        type: 'error',
        status: 500,
        body: 'boom',
      };

      await userEvent.click(screen.getByTestId('do-send'));
      await screen.findByTestId('error');

      await userEvent.click(screen.getByTestId('do-clear'));

      await waitFor(() => {
        expect(screen.queryByTestId('error')).toBeNull();
      });
    });
  });
});
