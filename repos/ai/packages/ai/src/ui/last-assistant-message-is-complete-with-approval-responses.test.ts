import { describe, expect, it } from 'vitest';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from './last-assistant-message-is-complete-with-approval-responses';

describe('lastAssistantMessageIsCompleteWithApprovalResponses', () => {
  it('should return false if messages is empty', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages: [] }),
    ).toBe(false);
  });

  it('should return false if last message is a user message', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [{ id: '1', role: 'user', parts: [] }],
      }),
    ).toBe(false);
  });

  it('should return false if there are no tool invocations in the last step', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              { type: 'text', text: 'Hello', state: 'done' },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return false if no tool has approval-responded state', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_1',
                state: 'approval-requested',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_1' },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return false if some tools still have approval-requested state', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_1', approved: true },
              },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_2',
                state: 'approval-requested',
                input: { city: 'Paris' },
                approval: { id: 'approval_2' },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should return true when a non-provider-executed tool has approval-responded', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_1', approved: true },
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true when a provider-executed tool has approval-responded', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'mcp.shorten_url',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { url: 'https://ai-sdk.dev/' },
                approval: { id: 'approval_1', approved: true },
                providerExecuted: true,
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true when all tools have a terminal state and at least one is approval-responded', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_1', approved: true },
              },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_2',
                state: 'output-available',
                input: { city: 'Paris' },
                output: { temperature: 20, weather: 'cloudy' },
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return true mixing provider-executed (approval-responded) and regular (output-available)', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'mcp.shorten_url',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { url: 'https://ai-sdk.dev/' },
                approval: { id: 'approval_1', approved: true },
                providerExecuted: true,
              },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_2',
                state: 'output-available',
                input: { city: 'Tokyo' },
                output: { temperature: 25, weather: 'sunny' },
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('should return false when provider-executed tool is approval-responded but regular tool is still approval-requested', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'dynamic-tool',
                toolName: 'mcp.shorten_url',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { url: 'https://ai-sdk.dev/' },
                approval: { id: 'approval_1', approved: true },
                providerExecuted: true,
              },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_2',
                state: 'approval-requested',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_2' },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('should only consider the last step in a multi-step message', () => {
    expect(
      lastAssistantMessageIsCompleteWithApprovalResponses({
        messages: [
          {
            id: '1',
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-getWeather',
                toolCallId: 'call_1',
                state: 'approval-responded',
                input: { city: 'Tokyo' },
                approval: { id: 'approval_1', approved: true },
              },
              { type: 'step-start' },
              { type: 'text', text: 'Done.', state: 'done' },
            ],
          },
        ],
      }),
    ).toBe(false);
  });
});
