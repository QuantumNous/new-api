import type {
  LanguageModelV4CallOptions,
  SharedV4Warning,
} from '@ai-sdk/provider';

export type HuggingFaceResponsesTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters: unknown;
};

export type HuggingFaceResponsesToolChoice =
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

export function prepareResponsesTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
}): {
  tools?: HuggingFaceResponsesTool[];
  toolChoice?: HuggingFaceResponsesToolChoice;
  toolWarnings: SharedV4Warning[];
} {
  // when the tools array is empty, change it to undefined to prevent errors:
  tools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV4Warning[] = [];

  if (tools == null) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const huggingfaceTools: HuggingFaceResponsesTool[] = [];

  for (const tool of tools) {
    switch (tool.type) {
      case 'function':
        huggingfaceTools.push({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        });
        break;
      case 'provider':
        toolWarnings.push({
          type: 'unsupported',
          feature: `provider-defined tool ${tool.id}`,
        });
        break;
      default: {
        const _exhaustiveCheck: never = tool;
        throw new Error(`Unsupported tool type: ${_exhaustiveCheck}`);
      }
    }
  }

  // prepare tool choice:
  let mappedToolChoice: HuggingFaceResponsesToolChoice | undefined = undefined;
  if (toolChoice) {
    switch (toolChoice.type) {
      case 'auto':
        mappedToolChoice = 'auto';
        break;
      case 'required':
        mappedToolChoice = 'required';
        break;
      case 'none':
        // not supported, ignore
        break;
      case 'tool':
        mappedToolChoice = {
          type: 'function',
          function: { name: toolChoice.toolName },
        };
        break;
      default: {
        const _exhaustiveCheck: never = toolChoice;
        throw new Error(`Unsupported tool choice type: ${_exhaustiveCheck}`);
      }
    }
  }

  return {
    tools: huggingfaceTools,
    toolChoice: mappedToolChoice,
    toolWarnings,
  };
}
