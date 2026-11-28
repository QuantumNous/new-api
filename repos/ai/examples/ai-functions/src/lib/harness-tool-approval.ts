import type { ModelMessage, StreamTextResult, ToolApprovalResponse } from 'ai';

type CapturedToolApproval = {
  approvalId: string;
  toolCall: {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    input: unknown;
    providerExecuted?: boolean;
  };
};

export async function printFullStreamAndCaptureToolApproval({
  result,
}: {
  result: StreamTextResult<any, any, any>;
}): Promise<CapturedToolApproval | undefined> {
  let approval: CapturedToolApproval | undefined;

  for await (const chunk of result.fullStream as AsyncIterable<any>) {
    switch (chunk.type) {
      case 'tool-call': {
        console.log(
          `\n\x1b[32m\x1b[1mTOOL CALL\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-approval-request': {
        approval ??= {
          approvalId: chunk.approvalId,
          toolCall: {
            type: 'tool-call',
            toolCallId: chunk.toolCall.toolCallId,
            toolName: chunk.toolCall.toolName,
            input: chunk.toolCall.input,
            ...(chunk.toolCall.providerExecuted !== undefined
              ? { providerExecuted: chunk.toolCall.providerExecuted }
              : {}),
          },
        };
        console.log(
          `\n\x1b[33m\x1b[1mTOOL APPROVAL REQUEST\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-approval-response': {
        console.log(
          `\n\x1b[33m\x1b[1mTOOL APPROVAL RESPONSE\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\n\x1b[32m\x1b[1mTOOL RESULT\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'reasoning-start':
        process.stdout.write('\n\n\x1b[34m\x1b[1mREASONING\x1b[22m\n');
        break;

      case 'text-start':
        process.stdout.write('\n\n\x1b[1mTEXT\x1b[22m\n');
        break;

      case 'text-delta':
      case 'reasoning-delta':
        process.stdout.write(chunk.text);
        break;

      case 'text-end':
      case 'reasoning-end':
        process.stdout.write('\x1b[0m\n');
        break;

      case 'error':
        console.error(
          `\n\x1b[31m\x1b[1mERROR\x1b[22m\n${formatStreamError(chunk.error)}\x1b[0m`,
        );
        break;
    }
  }

  return approval;
}

export function createToolApprovalResponseMessages({
  approval,
  approved,
  reason,
}: {
  approval: CapturedToolApproval;
  approved: boolean;
  reason?: string;
}): ModelMessage[] {
  const response: ToolApprovalResponse = {
    type: 'tool-approval-response',
    approvalId: approval.approvalId,
    approved,
    ...(reason !== undefined ? { reason } : {}),
  };

  return [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: approval.toolCall.toolCallId,
          toolName: approval.toolCall.toolName,
          input: approval.toolCall.input,
          ...(approval.toolCall.providerExecuted !== undefined
            ? { providerExecuted: approval.toolCall.providerExecuted }
            : {}),
        },
        {
          type: 'tool-approval-request',
          approvalId: approval.approvalId,
          toolCallId: approval.toolCall.toolCallId,
        },
      ],
    },
    {
      role: 'tool',
      content: [response],
    },
  ];
}

function formatStreamError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      null,
      2,
    );
  }
  return JSON.stringify(error, null, 2);
}
