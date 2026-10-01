import {
  convertToModelMessages,
  getStaticToolName,
  isStaticToolUIPart,
  type Tool,
  type ToolExecutionOptions,
  type ToolSet,
  type UIMessageStreamWriter,
} from 'ai';
import type { HumanInTheLoopUIMessage } from './types';

// Approval string to be shared across frontend and backend
export const APPROVAL = {
  YES: 'Yes, confirmed.',
  NO: 'No, denied.',
} as const;

function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T,
): key is K & keyof T {
  return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 *
 * @param options - The function options
 * @param options.tools - Map of tool names to Tool instances that may expose execute functions
 * @param options.writer - UIMessageStream writer for sending results back to the client
 * @param options.messages - Array of messages to process
 * @param executionFunctions - Map of tool names to execute functions
 * @returns Promise resolving to the processed messages
 */
export async function processToolCalls<
  Tools extends ToolSet,
  ExecutableTools extends {
    [Tool in keyof Tools as Tools[Tool] extends { execute: Function }
      ? never
      : Tool]: Tools[Tool];
  },
>(
  {
    writer,
    messages,
  }: {
    tools: Tools; // used for type inference
    writer: UIMessageStreamWriter;
    messages: HumanInTheLoopUIMessage[]; // IMPORTANT: replace with your message type
  },
  executeFunctions: {
    [K in keyof Tools & keyof ExecutableTools]?: (
      args: ExecutableTools[K] extends Tool<infer P> ? P : never,
      context: ToolExecutionOptions<{}>,
    ) => Promise<any>;
  },
): Promise<HumanInTheLoopUIMessage[]> {
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;
  if (!parts) return messages;

  const processedParts = await Promise.all(
    parts.map(async part => {
      // Only process tool invocations parts
      if (!isStaticToolUIPart(part)) return part;

      const toolName = getStaticToolName(part);

      // Only continue if we have an execute function for the tool (meaning it requires confirmation) and it's in a 'result' state
      if (!(toolName in executeFunctions) || part.state !== 'output-available')
        return part;

      let result;

      if (part.output === APPROVAL.YES) {
        // Get the tool and check if the tool has an execute function.
        if (
          !isValidToolName(toolName, executeFunctions) ||
          part.state !== 'output-available'
        ) {
          return part;
        }

        const toolInstance = executeFunctions[toolName] as Tool['execute'];
        if (toolInstance) {
          result = await toolInstance(part.input, {
            messages: await convertToModelMessages(messages),
            toolCallId: part.toolCallId,
            context: {},
          });
        } else {
          result = 'Error: No execute function found on tool';
        }
      } else if (part.output === APPROVAL.NO) {
        result = 'Error: User denied access to tool execution';
      } else {
        // For any unhandled responses, return the original part.
        return part;
      }

      // Forward updated tool result to the client.
      writer.write({
        type: 'tool-output-available',
        toolCallId: part.toolCallId,
        output: result,
      });

      // Return updated toolInvocation with the actual result.
      return {
        ...part,
        output: result,
      };
    }),
  );

  // Finally return the processed messages
  return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
}

export function getToolsRequiringConfirmation<
  T extends ToolSet,
  // E extends {
  //   [K in keyof T as T[K] extends { execute: Function } ? never : K]: T[K];
  // },
>(tools: T): string[] {
  return (Object.keys(tools) as (keyof T)[]).filter(key => {
    const maybeTool = tools[key];
    return typeof maybeTool.execute !== 'function';
  }) as string[];
}
