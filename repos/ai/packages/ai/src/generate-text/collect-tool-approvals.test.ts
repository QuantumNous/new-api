import { describe, expect, it } from 'vitest';
import { collectToolApprovals } from './collect-tool-approvals';

describe('collectToolApprovals', () => {
  it('should not return any tool approvals when the last message is not a tool message', () => {
    const result = collectToolApprovals({
      messages: [{ role: 'user', content: 'Hello, world!' }],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [],
        "deniedToolApprovals": [],
      }
    `);
  });

  it('should ignore approval request without response', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: { value: 'test-input' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-1',
            },
          ],
        },
        {
          role: 'tool',
          content: [],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [],
        "deniedToolApprovals": [],
      }
    `);
  });

  it('should return approved approval with approved response', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: { value: 'test-input' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-1',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-1',
              approved: true,
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [
          {
            "approvalRequest": {
              "approvalId": "approval-id-1",
              "toolCallId": "call-1",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-1",
              "approved": true,
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
        ],
        "deniedToolApprovals": [],
      }
    `);
  });

  it('should return processed approval with approved response and tool result', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: { value: 'test-input' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-1',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-1',
              approved: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'tool1',
              output: { type: 'text', value: 'test-output' },
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [],
        "deniedToolApprovals": [],
      }
    `);
  });

  it('should return denied approval with denied response', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: { value: 'test-input' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-1',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-1',
              approved: false,
              reason: 'test-reason',
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [],
        "deniedToolApprovals": [
          {
            "approvalRequest": {
              "approvalId": "approval-id-1",
              "toolCallId": "call-1",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-1",
              "approved": false,
              "reason": "test-reason",
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
        ],
      }
    `);
  });

  it('should return processed approval with denied response and tool result', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: { value: 'test-input' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-1',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-1',
              approved: false,
              reason: 'test-reason',
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'tool1',
              output: { type: 'execution-denied', reason: 'test-reason' },
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [],
        "deniedToolApprovals": [],
      }
    `);
  });

  it('should throw when approval response has unknown approvalId', () => {
    expect(() =>
      collectToolApprovals({
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'tool1',
                input: { value: 'test-input' },
              },
              {
                type: 'tool-approval-request',
                approvalId: 'approval-id-1',
                toolCallId: 'call-1',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'unknown-approval-id', // doesn't match any request
                approved: true,
              },
            ],
          },
        ],
      }),
    ).toThrow(
      'Tool approval response references unknown approvalId: "unknown-approval-id"',
    );
  });

  it('should throw when referenced tool call does not exist', () => {
    expect(() =>
      collectToolApprovals({
        messages: [
          {
            role: 'assistant',
            content: [
              // No tool-call part, only the approval request
              {
                type: 'tool-approval-request',
                approvalId: 'approval-id-1',
                toolCallId: 'call-that-does-not-exist',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-approval-response',
                approvalId: 'approval-id-1',
                approved: true,
              },
            ],
          },
        ],
      }),
    ).toThrow(
      'Tool call "call-that-does-not-exist" not found for approval request "approval-id-1".',
    );
  });

  it('should work for 2 approvals, 2 rejections, 1 approval with tool result, 1 rejection with tool result', () => {
    const result = collectToolApprovals({
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-approval-1',
              toolName: 'tool1',
              input: { value: 'test-input-1' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-1',
              toolCallId: 'call-approval-1',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-approval-2',
              toolName: 'tool1',
              input: { value: 'test-input-2' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-2',
              toolCallId: 'call-approval-2',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-approval-3',
              toolName: 'tool1',
              input: { value: 'test-input-3' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-3',
              toolCallId: 'call-approval-3',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-approval-4',
              toolName: 'tool1',
              input: { value: 'test-input-4' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-4',
              toolCallId: 'call-approval-4',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-approval-5',
              toolName: 'tool1',
              input: { value: 'test-input-5' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-5',
              toolCallId: 'call-approval-5',
            },
            {
              type: 'tool-call',
              toolCallId: 'call-approval-6',
              toolName: 'tool1',
              input: { value: 'test-input-6' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-id-6',
              toolCallId: 'call-approval-6',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-1',
              approved: true,
            },
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-2',
              approved: true,
            },
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-3',
              approved: false,
              reason: 'test-reason',
            },
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-4',
              approved: false,
            },
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-5',
              approved: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-approval-5',
              toolName: 'tool1',
              output: { type: 'text', value: 'test-output-5' },
            },
            {
              type: 'tool-approval-response',
              approvalId: 'approval-id-6',
              approved: false,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-approval-6',
              toolName: 'tool1',
              output: { type: 'execution-denied' },
            },
          ],
        },
      ],
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "approvedToolApprovals": [
          {
            "approvalRequest": {
              "approvalId": "approval-id-1",
              "toolCallId": "call-approval-1",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-1",
              "approved": true,
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input-1",
              },
              "toolCallId": "call-approval-1",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
          {
            "approvalRequest": {
              "approvalId": "approval-id-2",
              "toolCallId": "call-approval-2",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-2",
              "approved": true,
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input-2",
              },
              "toolCallId": "call-approval-2",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
        ],
        "deniedToolApprovals": [
          {
            "approvalRequest": {
              "approvalId": "approval-id-3",
              "toolCallId": "call-approval-3",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-3",
              "approved": false,
              "reason": "test-reason",
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input-3",
              },
              "toolCallId": "call-approval-3",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
          {
            "approvalRequest": {
              "approvalId": "approval-id-4",
              "toolCallId": "call-approval-4",
              "type": "tool-approval-request",
            },
            "approvalResponse": {
              "approvalId": "approval-id-4",
              "approved": false,
              "type": "tool-approval-response",
            },
            "toolCall": {
              "input": {
                "value": "test-input-4",
              },
              "toolCallId": "call-approval-4",
              "toolName": "tool1",
              "type": "tool-call",
            },
          },
        ],
      }
    `);
  });
});
