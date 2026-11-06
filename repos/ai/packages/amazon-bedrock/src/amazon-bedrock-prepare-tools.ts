import {
  UnsupportedFunctionalityError,
  type JSONObject,
  type LanguageModelV4CallOptions,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import { asSchema } from '@ai-sdk/provider-utils';
import {
  anthropicTools,
  prepareTools as prepareAnthropicTools,
} from '@ai-sdk/anthropic/internal';
import type {
  AmazonBedrockTool,
  AmazonBedrockToolConfiguration,
} from './amazon-bedrock-api-types';

export async function prepareTools({
  tools,
  toolChoice,
  modelId,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
  modelId: string;
}): Promise<{
  toolConfig: AmazonBedrockToolConfiguration;
  additionalTools: Record<string, unknown> | undefined;
  betas: Set<string>;
  toolWarnings: SharedV4Warning[];
}> {
  const toolWarnings: SharedV4Warning[] = [];
  const betas = new Set<string>();

  if (tools == null || tools.length === 0) {
    return {
      toolConfig: {},
      additionalTools: undefined,
      betas,
      toolWarnings,
    };
  }

  // Filter out unsupported web_search tool and add a warning
  const supportedTools = tools.filter(tool => {
    if (
      tool.type === 'provider' &&
      tool.id === 'anthropic.web_search_20250305'
    ) {
      toolWarnings.push({
        type: 'unsupported',
        feature: 'web_search_20250305 tool',
        details:
          'The web_search_20250305 tool is not supported on Amazon Bedrock.',
      });
      return false; // Exclude this tool
    }
    return true; // Include all other tools
  });

  if (supportedTools.length === 0) {
    return {
      toolConfig: {},
      additionalTools: undefined,
      betas,
      toolWarnings,
    };
  }

  const isAnthropicModel = modelId.includes('anthropic.');
  const ProviderTools = supportedTools.filter(t => t.type === 'provider');
  const functionTools = supportedTools.filter(t => t.type === 'function');

  let additionalTools: Record<string, unknown> | undefined = undefined;
  const amazonBedrockTools: AmazonBedrockTool[] = [];

  const usingAnthropicTools = isAnthropicModel && ProviderTools.length > 0;

  // Handle Anthropic provider-defined tools for Anthropic models on Bedrock
  if (usingAnthropicTools) {
    const {
      toolChoice: preparedAnthropicToolChoice,
      toolWarnings: anthropicToolWarnings,
      betas: anthropicBetas,
    } = await prepareAnthropicTools({
      tools: ProviderTools,
      toolChoice,
      supportsStructuredOutput: false,
      supportsStrictTools: false,
    });

    toolWarnings.push(...anthropicToolWarnings);
    anthropicBetas.forEach(beta => betas.add(beta));

    // For Anthropic tools on Bedrock, only the 'tool_choice' goes into additional fields.
    // The tool definitions themselves are sent in the standard 'toolConfig'.
    if (preparedAnthropicToolChoice) {
      additionalTools = {
        tool_choice: preparedAnthropicToolChoice,
      };
    }

    // Create a standard Bedrock tool representation for validation purposes
    for (const tool of ProviderTools) {
      const toolFactory = Object.values(anthropicTools).find(factory => {
        const instance = (factory as (args: any) => any)({});
        return instance.id === tool.id;
      });

      if (toolFactory != null) {
        const fullToolDefinition = (toolFactory as (args: any) => any)({});
        amazonBedrockTools.push({
          toolSpec: {
            name: tool.name,
            inputSchema: {
              json: (await asSchema(fullToolDefinition.inputSchema)
                .jsonSchema) as JSONObject,
            },
          },
        });
      } else {
        toolWarnings.push({ type: 'unsupported', feature: 'tool ${tool.id}' });
      }
    }
  } else {
    // Report unsupported provider-defined tools for non-anthropic models
    for (const tool of ProviderTools) {
      toolWarnings.push({ type: 'unsupported', feature: `tool ${tool.id}` });
    }
  }

  const filteredFunctionTools =
    toolChoice?.type === 'tool'
      ? functionTools.filter(t => t.name === toolChoice.toolName)
      : functionTools;

  // Bedrock's Messages API rejects `strict` on tools for these models.
  // https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html
  const supportsStrictOnTools =
    !modelId.includes('claude-opus-4-7') &&
    !modelId.includes('claude-opus-4-8');

  for (const tool of filteredFunctionTools) {
    amazonBedrockTools.push({
      toolSpec: {
        name: tool.name,
        ...(tool.description?.trim() !== ''
          ? { description: tool.description }
          : {}),
        ...(tool.strict != null && supportsStrictOnTools
          ? { strict: tool.strict }
          : {}),
        inputSchema: {
          json: tool.inputSchema as JSONObject,
        },
      },
    });
  }

  // Handle toolChoice for standard Bedrock tools, but NOT for Anthropic provider-defined tools
  let amazonBedrockToolChoice: AmazonBedrockToolConfiguration['toolChoice'] =
    undefined;
  if (!usingAnthropicTools && amazonBedrockTools.length > 0 && toolChoice) {
    const type = toolChoice.type;
    switch (type) {
      case 'auto':
        amazonBedrockToolChoice = { auto: {} };
        break;
      case 'required':
        amazonBedrockToolChoice = { any: {} };
        break;
      case 'none':
        amazonBedrockTools.length = 0;
        amazonBedrockToolChoice = undefined;
        break;
      case 'tool':
        amazonBedrockToolChoice = { tool: { name: toolChoice.toolName } };
        break;
      default: {
        const _exhaustiveCheck: never = type;
        throw new UnsupportedFunctionalityError({
          functionality: `tool choice type: ${_exhaustiveCheck}`,
        });
      }
    }
  }

  const toolConfig: AmazonBedrockToolConfiguration =
    amazonBedrockTools.length > 0
      ? { tools: amazonBedrockTools, toolChoice: amazonBedrockToolChoice }
      : {};

  return {
    toolConfig,
    additionalTools,
    betas,
    toolWarnings,
  };
}
