import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { createAgent, humanInTheLoopMiddleware } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { MemorySaver, Command } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Allow streaming responses up to 60 seconds
 */
export const maxDuration = 60;

/**
 * In-memory store for thread checkpoints
 * In production, use a persistent checkpointer like AsyncPostgresSaver
 */
const checkpointer = new MemorySaver();

/**
 * The model to use for the agent
 */
const model = new ChatOpenAI({
  model: 'gpt-5',
  reasoning: {
    effort: 'low', // 'low' | 'medium' | 'high' - controls reasoning depth
    summary: 'auto', // Enable reasoning summary output for streaming
  },
});

/**
 * Send email tool - simulates sending an email (requires approval)
 */
const sendEmailTool = tool(
  async ({ to, subject, body }) => {
    // Simulate sending email
    await new Promise(resolve => setTimeout(resolve, 500));
    return `Email sent successfully to ${to} with subject "${subject}"`;
  },
  {
    name: 'send_email',
    description:
      'Send an email to a recipient. This action requires human approval.',
    schema: z.object({
      to: z.string().describe('The email recipient'),
      subject: z.string().describe('The email subject'),
      body: z.string().describe('The email body content'),
    }),
  },
);

/**
 * Delete file tool - simulates deleting a file (requires approval)
 */
const deleteFileTool = tool(
  async ({ filename }) => {
    // Simulate file deletion
    await new Promise(resolve => setTimeout(resolve, 300));
    return `File "${filename}" has been deleted successfully`;
  },
  {
    name: 'delete_file',
    description:
      'Delete a file from the system. This action requires human approval.',
    schema: z.object({
      filename: z.string().describe('The name of the file to delete'),
    }),
  },
);

/**
 * Search tool - simulates searching (auto-approved, no HITL)
 */
const searchTool = tool(
  async ({ query }) => {
    // Simulate search
    await new Promise(resolve => setTimeout(resolve, 200));
    const results = [
      `Result 1 for "${query}": Found relevant information about ${query}`,
      `Result 2 for "${query}": Additional context regarding ${query}`,
    ];
    return results.join('\n');
  },
  {
    name: 'search',
    description: 'Search for information. This action is auto-approved.',
    schema: z.object({
      query: z.string().describe('The search query'),
    }),
  },
);

/**
 * Create the agent with HITL middleware
 * All tool calls will require human approval except for search
 */
const agent = createAgent({
  model,
  tools: [sendEmailTool, deleteFileTool, searchTool],
  checkpointer,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: {
        // Require approval for sensitive operations
        send_email: {
          allowedDecisions: ['approve', 'edit', 'reject'],
        },
        delete_file: {
          allowedDecisions: ['approve', 'reject'], // No editing allowed for delete
        },
        // Auto-approve safe operations
        search: false,
      },
      descriptionPrefix: '🔒 Action requires approval',
    }),
  ],
  systemPrompt: `You are a helpful AI assistant with access to tools that can perform actions.

IMPORTANT: When the user asks you to perform an action (send email, delete file, etc.), you MUST use the appropriate tool immediately. Do NOT ask for confirmation - the system has built-in approval workflows that will handle user confirmation automatically.

Available tools:
- send_email: Send emails (system will ask user for approval)
- delete_file: Delete files (system will ask user for approval)
- search: Search for information (auto-approved)

Always use the tools directly when the user requests an action. The approval system will pause execution and ask the user to approve before any sensitive action is actually performed.`,
});

/**
 * Extract tool approval responses from UI messages
 */
function extractApprovalResponses(messages: UIMessage[]): Array<{
  approvalId: string;
  approved: boolean;
  reason?: string;
}> {
  const responses: Array<{
    approvalId: string;
    approved: boolean;
    reason?: string;
  }> = [];

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    for (const part of message.parts) {
      // Check for dynamic-tool parts with approval-responded state
      if (
        part.type === 'dynamic-tool' &&
        part.state === 'approval-responded' &&
        'approval' in part &&
        part.approval
      ) {
        responses.push({
          approvalId: part.approval.id,
          approved: part.approval.approved,
          reason: part.approval.reason,
        });
      }
    }
  }

  return responses;
}

/**
 * The API route for the HITL agent
 */
export async function POST(req: Request) {
  try {
    const {
      messages,
      threadId,
    }: {
      messages: UIMessage[];
      threadId: string;
    } = await req.json();

    /**
     * Configuration with thread ID for persistence
     */
    const config = {
      configurable: { thread_id: threadId },
      streamMode: ['values', 'messages'] as ['values', 'messages'],
    };

    let stream: ReadableStream;

    /**
     * Check if there are any approval responses in the messages
     */
    const approvalResponses = extractApprovalResponses(messages);
    if (approvalResponses.length > 0) {
      /**
       * Resume from interrupt with human decisions
       */
      const decisions = approvalResponses.map(response => {
        if (response.approved) {
          return {
            type: 'approve' as const,
          };
        }
        return {
          type: 'reject' as const,
          reason: response.reason,
        };
      });

      stream = await agent.stream(
        new Command({ resume: { decisions } }),
        config,
      );
    } else {
      /**
       * Convert AI SDK UIMessages to LangChain messages and start new conversation
       */
      const langchainMessages = await toBaseMessages(messages);
      stream = await agent.stream({ messages: langchainMessages }, config);
    }

    /**
     * Convert the LangChain stream to UI message stream
     */
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream as unknown as ReadableStream),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
