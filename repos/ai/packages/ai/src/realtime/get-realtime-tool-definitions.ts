import {
  asSchema,
  type InferToolSetContext,
  type Tool,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type { RealtimeToolDefinition } from '../types/realtime-model';

export async function getRealtimeToolDefinitions<TOOLS extends ToolSet>({
  tools,
  toolsContext = {} as InferToolSetContext<TOOLS>,
}: {
  tools: TOOLS;
  toolsContext?: InferToolSetContext<TOOLS>;
}): Promise<RealtimeToolDefinition[]> {
  const definitions: RealtimeToolDefinition[] = [];

  for (const [name, tool] of Object.entries(tools)) {
    const toolType = tool.type;

    switch (toolType) {
      case undefined:
      case 'function':
      case 'dynamic': {
        const description = resolveRealtimeToolDescription({
          tool,
          toolName: name,
          toolsContext,
        });
        definitions.push({
          type: 'function',
          name,
          description,
          parameters: await asSchema(tool.inputSchema).jsonSchema,
        });
        break;
      }
      case 'provider':
        break;
      default: {
        const exhaustiveCheck: never = toolType as never;
        throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
      }
    }
  }

  return definitions;
}

function resolveRealtimeToolDescription<TOOLS extends ToolSet>({
  tool,
  toolName,
  toolsContext,
}: {
  tool: Tool;
  toolName: string;
  toolsContext: InferToolSetContext<TOOLS>;
}): string | undefined {
  return tool.description === undefined
    ? undefined
    : typeof tool.description === 'string'
      ? tool.description
      : tool.description({
          context: toolsContext[toolName as keyof InferToolSetContext<TOOLS>],
        });
}
