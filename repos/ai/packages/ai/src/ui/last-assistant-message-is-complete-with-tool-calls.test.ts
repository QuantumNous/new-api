import { lastAssistantMessageIsCompleteWithToolCalls } from './last-assistant-message-is-complete-with-tool-calls';
import { describe, it, expect } from 'vitest';

describe('lastAssistantMessageIsCompleteWithToolCalls', () => {
  it('should return false if the last step of a multi-step sequence only has text', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getLocation',
                toolCallId: 'call_CuEdmzpx4ZldCkg5SVr3ikLz',
                state: 'output-available',
                input: {},
                output: 'New York',
              },
              { type: 'step-start' },
              {
                type: 'text',
                text: 'The current weather in New York is windy.',
                state: 'done',
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return true when there is a text part after the last tool result in the last step', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeatherInformation',
                toolCallId: 'call_6iy0GxZ9R4VDI5MKohXxV48y',
                state: 'output-available',
                input: {
                  city: 'New York',
                },
                output: 'windy',
              },
              {
                type: 'text',
                text: 'The current weather in New York is windy.',
                state: 'done',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true when the tool has a output-error state', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeatherInformation',
                toolCallId: 'call_6iy0GxZ9R4VDI5MKohXxV48y',
                state: 'output-error',
                input: {
                  city: 'New York',
                },
                errorText: 'Unable to get weather information',
              },
              {
                type: 'text',
                text: 'The current weather in New York is windy.',
                state: 'done',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true when dynamic tool call is complete', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'output-available',
                input: {
                  location: 'San Francisco',
                },
                output: 'sunny',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return false when dynamic tool call is still streaming input', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'input-streaming',
                input: {
                  location: 'San Francisco',
                },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return false when dynamic tool call has input but no output', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'input-available',
                input: {
                  location: 'San Francisco',
                },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return true when dynamic tool call has an error', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'output-error',
                input: {
                  location: 'San Francisco',
                },
                errorText: 'Failed to fetch weather data',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true when mixing regular and dynamic tool calls and all are complete', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeatherInformation',
                toolCallId: 'call_regular_123',
                state: 'output-available',
                input: {
                  city: 'New York',
                },
                output: 'windy',
              },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'output-available',
                input: {
                  location: 'San Francisco',
                },
                output: 'sunny',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return false when mixing regular and dynamic tool calls and some are incomplete', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeatherInformation',
                toolCallId: 'call_regular_123',
                state: 'output-available',
                input: {
                  city: 'New York',
                },
                output: 'windy',
              },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_123',
                state: 'input-available', // incomplete
                input: {
                  location: 'San Francisco',
                },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return true for multi-step sequence where last step has complete dynamic tool calls', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              // First step with regular tool
              { type: 'step-start' },
              {
                type: 'tool-getLocation',
                toolCallId: 'call_location_123',
                state: 'output-available',
                input: {},
                output: 'New York',
              },
              // Second step with dynamic tool
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_456',
                state: 'output-available',
                input: {
                  location: 'New York',
                },
                output: 'cloudy',
              },
              {
                type: 'text',
                text: 'The current weather in New York is cloudy.',
                state: 'done',
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return false for multi-step sequence where last step has incomplete dynamic tool calls', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              // First step with regular tool
              { type: 'step-start' },
              {
                type: 'tool-getLocation',
                toolCallId: 'call_location_123',
                state: 'output-available',
                input: {},
                output: 'New York',
              },
              // Second step with incomplete dynamic tool
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'getDynamicWeather',
                toolCallId: 'call_dynamic_456',
                state: 'input-streaming', // incomplete
                input: {
                  location: 'New York',
                },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return false for complete provider executed tool calls', () => {
    expect(
      lastAssistantMessageIsCompleteWithToolCalls({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-web_search',
                input: {
                  query: 'New York weather',
                },
                state: 'output-available',
                output: [],
                toolCallId: 'srvtoolu_01KSMqkKSbgKhCwGZHQDaV48',
                providerExecuted: true,
              },
              {
                type: 'text',
                text: 'The current weather in New York is windy.',
                state: 'done',
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });
});
