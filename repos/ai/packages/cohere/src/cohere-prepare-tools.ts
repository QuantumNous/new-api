import {
  UnsupportedFunctionalityError,
  type LanguageModelV4CallOptions,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import type { CohereToolChoice } from './cohere-chat-prompt';

export function prepareTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
}): {
  tools:
    | Array<{
        type: 'function';
        function: {
          name: string | undefined;
          description: string | undefined;
          parameters: unknown;
        };
      }>
    | undefined;
  toolChoice: CohereToolChoice;
  toolWarnings: SharedV4Warning[];
} {
  // when the tools array is empty, change it to undefined to prevent errors:
  tools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV4Warning[] = [];

  if (tools == null) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const cohereTools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string | undefined;
      parameters: unknown;
    };
  }> = [];

  for (const tool of tools) {
    if (tool.type === 'provider') {
      toolWarnings.push({
        type: 'unsupported',
        feature: `provider-defined tool ${tool.id}`,
      });
    } else {
      cohereTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      });
    }
  }

  if (toolChoice == null) {
    return { tools: cohereTools, toolChoice: undefined, toolWarnings };
  }

  const type = toolChoice.type;

  switch (type) {
    case 'auto':
      return { tools: cohereTools, toolChoice: undefined, toolWarnings };

    case 'none':
      return { tools: cohereTools, toolChoice: 'NONE', toolWarnings };

    case 'required':
      return { tools: cohereTools, toolChoice: 'REQUIRED', toolWarnings };

    case 'tool':
      return {
        tools: cohereTools.filter(
          tool => tool.function.name === toolChoice.toolName,
        ),
        toolChoice: 'REQUIRED',
        toolWarnings,
      };

    default: {
      const _exhaustiveCheck: never = type;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`,
      });
    }
  }
}
