import { describe, expect, it } from 'vitest';
import { convertToLanguageModelPrompt } from './convert-to-language-model-prompt';
import { MissingToolResultsError } from '../error/missing-tool-result-error';

describe('tool validation', () => {
  it('should pass validation for provider-executed tools (deferred results)', async () => {
    const result = await convertToLanguageModelPrompt({
      prompt: {
        instructions: undefined,
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'code_interpreter',
                input: { code: 'print("hello")' },
                providerExecuted: true,
              },
            ],
          },
        ],
      },
      supportedUrls: {},
      download: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  it('should pass validation for tool-approval-response', async () => {
    const result = await convertToLanguageModelPrompt({
      prompt: {
        instructions: undefined,
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_to_approve',
                toolName: 'dangerous_action',
                input: { action: 'delete_db' },
              },
              {
                type: 'tool-approval-request',
                toolCallId: 'call_to_approve',
                approvalId: 'approval_123',
                toolName: 'dangerous_action',
                input: { action: 'delete_db' },
              } as any,
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval_123',
                approved: true,
              } as any,
            ],
          },
        ],
      },
      supportedUrls: {},
      download: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  it('should preserve provider-executed tool-approval-response', async () => {
    const result = await convertToLanguageModelPrompt({
      prompt: {
        instructions: undefined,
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_provider_executed',
                toolName: 'mcp_tool',
                input: { action: 'execute' },
                providerExecuted: true,
              },
              {
                type: 'tool-approval-request',
                toolCallId: 'call_provider_executed',
                approvalId: 'approval_provider',
                toolName: 'mcp_tool',
                input: { action: 'execute' },
              } as any,
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval_provider',
                approved: true,
                providerExecuted: true,
              },
            ],
          },
        ],
      },
      supportedUrls: {},
      download: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  it('should throw error for actual missing results', async () => {
    await expect(async () => {
      await convertToLanguageModelPrompt({
        prompt: {
          instructions: undefined,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_missing_result',
                  toolName: 'regular_tool',
                  input: {},
                },
              ],
            },
          ],
        },
        supportedUrls: {},
        download: undefined,
      });
    }).rejects.toThrow(MissingToolResultsError);
  });
});
