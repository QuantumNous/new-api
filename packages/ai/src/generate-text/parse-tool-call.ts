import type { LanguageModelV4ToolCall } from '@ai-sdk/provider';
import {
  asSchema,
  safeParseJSON,
  safeValidateTypes,
  type InferToolInput,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { InvalidToolInputError } from '../error/invalid-tool-input-error';
import { NoSuchToolError } from '../error/no-such-tool-error';
import { ToolCallRepairError } from '../error/tool-call-repair-error';
import type { Instructions } from '../prompt';
import type { DynamicToolCall, TypedToolCall } from './tool-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type { ToolInputRefinement } from './tool-input-refinement';

export async function parseToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
  repairToolCall,
  refineToolInput,
  messages,
  instructions,
}: {
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS | undefined;
  repairToolCall: ToolCallRepairFunction<TOOLS> | undefined;
  refineToolInput?: ToolInputRefinement<TOOLS> | undefined;
  instructions: Instructions | undefined;
  messages: ModelMessage[];
}): Promise<TypedToolCall<TOOLS>> {
  try {
    if (tools == null) {
      // provider-executed dynamic tools are not part of our list of tools:
      if (toolCall.providerExecuted && toolCall.dynamic) {
        return await refineParsedToolCallInput({
          toolCall: await parseProviderExecutedDynamicToolCall(toolCall),
          refineToolInput,
        });
      }

      throw new NoSuchToolError({ toolName: toolCall.toolName });
    }

    try {
      return await refineParsedToolCallInput({
        toolCall: await doParseToolCall({ toolCall, tools }),
        refineToolInput,
      });
    } catch (error) {
      if (
        repairToolCall == null ||
        !(
          NoSuchToolError.isInstance(error) ||
          InvalidToolInputError.isInstance(error)
        )
      ) {
        throw error;
      }

      let repairedToolCall: LanguageModelV4ToolCall | null = null;

      try {
        repairedToolCall = await repairToolCall({
          toolCall,
          tools,
          inputSchema: async ({ toolName }) => {
            const { inputSchema } = tools[toolName];
            return await asSchema(inputSchema).jsonSchema;
          },
          instructions,
          system: instructions,
          messages,
          error,
        });
      } catch (repairError) {
        throw new ToolCallRepairError({
          cause: repairError,
          originalError: error,
        });
      }

      // no repaired tool call returned
      if (repairedToolCall == null) {
        throw error;
      }

      return await refineParsedToolCallInput({
        toolCall: await doParseToolCall({ toolCall: repairedToolCall, tools }),
        refineToolInput,
      });
    }
  } catch (error) {
    // use parsed input when possible
    const parsedInput = await safeParseJSON({ text: toolCall.input });
    const input = parsedInput.success ? parsedInput.value : toolCall.input;
    const tool = tools?.[toolCall.toolName];

    // TODO AI SDK 6: special invalid tool call parts
    return {
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input,
      dynamic: true,
      invalid: true,
      error,
      title: tool?.title,
      providerExecuted: toolCall.providerExecuted,
      providerMetadata: toolCall.providerMetadata,
      ...(tool?.metadata != null ? { toolMetadata: tool.metadata } : {}),
    };
  }
}

async function refineParsedToolCallInput<TOOLS extends ToolSet>({
  toolCall,
  refineToolInput,
}: {
  toolCall: TypedToolCall<TOOLS>;
  refineToolInput: ToolInputRefinement<TOOLS> | undefined;
}): Promise<TypedToolCall<TOOLS>> {
  const refine = refineToolInput?.[toolCall.toolName];

  if (refine == null) {
    return toolCall;
  }

  return {
    ...toolCall,
    input: await refine(toolCall.input as InferToolInput<TOOLS[keyof TOOLS]>),
  } as TypedToolCall<TOOLS>;
}

async function parseProviderExecutedDynamicToolCall(
  toolCall: LanguageModelV4ToolCall,
): Promise<DynamicToolCall> {
  const parseResult =
    toolCall.input.trim() === ''
      ? { success: true as const, value: {} }
      : await safeParseJSON({ text: toolCall.input });

  if (parseResult.success === false) {
    throw new InvalidToolInputError({
      toolName: toolCall.toolName,
      toolInput: toolCall.input,
      cause: parseResult.error,
    });
  }

  return {
    type: 'tool-call',
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    input: parseResult.value,
    providerExecuted: true,
    dynamic: true,
    providerMetadata: toolCall.providerMetadata,
  };
}

async function doParseToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
}: {
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS;
}): Promise<TypedToolCall<TOOLS>> {
  const toolName = toolCall.toolName as keyof TOOLS & string;

  const tool = tools[toolName];

  if (tool == null) {
    // provider-executed dynamic tools are not part of our list of tools:
    if (toolCall.providerExecuted && toolCall.dynamic) {
      return await parseProviderExecutedDynamicToolCall(toolCall);
    }

    throw new NoSuchToolError({
      toolName: toolCall.toolName,
      availableTools: Object.keys(tools),
    });
  }

  const schema = asSchema(tool.inputSchema);

  // when the tool call has no arguments, we try passing an empty object to the schema
  // (many LLMs generate empty strings for tool calls with no arguments)
  const parseResult =
    toolCall.input.trim() === ''
      ? await safeValidateTypes({ value: {}, schema })
      : await safeParseJSON({ text: toolCall.input, schema });

  if (parseResult.success === false) {
    throw new InvalidToolInputError({
      toolName,
      toolInput: toolCall.input,
      cause: parseResult.error,
    });
  }

  return tool.type === 'dynamic'
    ? {
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: parseResult.value,
        providerExecuted: toolCall.providerExecuted,
        providerMetadata: toolCall.providerMetadata,
        ...(tool.metadata != null ? { toolMetadata: tool.metadata } : {}),
        dynamic: true,
        title: tool.title,
      }
    : {
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName,
        input: parseResult.value,
        providerExecuted: toolCall.providerExecuted,
        providerMetadata: toolCall.providerMetadata,
        ...(tool.metadata != null ? { toolMetadata: tool.metadata } : {}),
        title: tool.title,
      };
}
