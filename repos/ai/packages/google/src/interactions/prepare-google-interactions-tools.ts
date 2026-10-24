import type {
  LanguageModelV4CallOptions,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type {
  GoogleInteractionsTool,
  GoogleInteractionsToolChoice,
} from './google-interactions-prompt';

export type PrepareGoogleInteractionsToolsResult = {
  tools: Array<GoogleInteractionsTool> | undefined;
  toolChoice: GoogleInteractionsToolChoice | undefined;
  toolWarnings: Array<SharedV4Warning>;
};

/**
 * Maps AI SDK tool definitions and `toolChoice` onto the Gemini Interactions
 * `tools[]` and `tool_choice` request fields.
 *
 * AI SDK function tools (`{ type: 'function', name, description, inputSchema }`)
 * map to Interactions `{ type: 'function', name, description, parameters }`,
 * with `parameters` passed through as plain JSON Schema (per
 * `googleapis/js-genai` `samples/interactions_tool_call_with_functions.ts` and
 * `src/interactions/resources/interactions.ts` `Function.parameters: unknown`).
 *
 * Provider-defined tools (`{ type: 'provider', id: 'google.<name>', args }`)
 * map to the discriminated `Tool` union. The full set of
 * provider-defined tool ids supported here:
 *
 * - `google.google_search`     -> `{ type: 'google_search', search_types? }`
 * - `google.code_execution`    -> `{ type: 'code_execution' }`
 * - `google.url_context`       -> `{ type: 'url_context' }`
 * - `google.file_search`       -> `{ type: 'file_search', file_search_store_names?, top_k?, metadata_filter? }`
 * - `google.google_maps`       -> `{ type: 'google_maps', latitude?, longitude?, enable_widget? }`
 * - `google.computer_use`      -> `{ type: 'computer_use', environment?, excludedPredefinedFunctions? }`
 * - `google.mcp_server`        -> `{ type: 'mcp_server', name?, url?, headers?, allowed_tools? }`
 * - `google.retrieval`         -> `{ type: 'retrieval', retrieval_types?, vertex_ai_search_config? }`
 *
 * `toolChoice` shapes:
 * - `'auto'`     -> `'auto'`
 * - `'required'` -> `'any'`
 * - `'none'`     -> `'none'`
 * - `{ type: 'tool', toolName }` -> `{ allowed_tools: { mode: 'validated', tools: [name] } }`
 *   (Interactions `AllowedTools.tools` is an `Array<string>` of function
 *   names, not tool descriptors -- see `src/interactions/resources/interactions.ts`
 *   line ~151).
 */
export function prepareGoogleInteractionsTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
}): PrepareGoogleInteractionsToolsResult {
  const toolWarnings: Array<SharedV4Warning> = [];

  const normalized = tools?.length ? tools : undefined;

  if (normalized == null) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const interactionsTools: Array<GoogleInteractionsTool> = [];

  for (const tool of normalized) {
    if (tool.type === 'function') {
      interactionsTools.push({
        type: 'function',
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.inputSchema,
      });
      continue;
    }

    if (tool.type === 'provider') {
      const args = (tool.args ?? {}) as Record<string, unknown>;
      switch (tool.id) {
        case 'google.google_search': {
          const searchTypesArg = args.searchTypes as
            | { webSearch?: unknown; imageSearch?: unknown }
            | undefined;
          let search_types:
            | Array<'web_search' | 'image_search' | 'enterprise_web_search'>
            | undefined;
          if (searchTypesArg != null && typeof searchTypesArg === 'object') {
            const list: Array<
              'web_search' | 'image_search' | 'enterprise_web_search'
            > = [];
            if (searchTypesArg.webSearch != null) list.push('web_search');
            if (searchTypesArg.imageSearch != null) list.push('image_search');
            if (list.length > 0) {
              search_types = list;
            }
          }
          interactionsTools.push({
            type: 'google_search',
            ...(search_types != null ? { search_types } : {}),
          });
          break;
        }
        case 'google.code_execution': {
          interactionsTools.push({ type: 'code_execution' });
          break;
        }
        case 'google.url_context': {
          interactionsTools.push({ type: 'url_context' });
          break;
        }
        case 'google.file_search': {
          interactionsTools.push({
            type: 'file_search',
            ...(args.fileSearchStoreNames != null
              ? {
                  file_search_store_names:
                    args.fileSearchStoreNames as Array<string>,
                }
              : {}),
            ...(args.topK != null ? { top_k: args.topK as number } : {}),
            ...(args.metadataFilter != null
              ? { metadata_filter: args.metadataFilter as string }
              : {}),
          });
          break;
        }
        case 'google.google_maps': {
          interactionsTools.push({
            type: 'google_maps',
            ...(args.latitude != null
              ? { latitude: args.latitude as number }
              : {}),
            ...(args.longitude != null
              ? { longitude: args.longitude as number }
              : {}),
            ...(args.enableWidget != null
              ? { enable_widget: args.enableWidget as boolean }
              : {}),
          });
          break;
        }
        case 'google.computer_use': {
          interactionsTools.push({
            type: 'computer_use',
            environment:
              (args.environment as 'browser' | undefined) ?? 'browser',
            ...(args.excludedPredefinedFunctions != null
              ? {
                  excludedPredefinedFunctions:
                    args.excludedPredefinedFunctions as Array<string>,
                }
              : {}),
          });
          break;
        }
        case 'google.mcp_server': {
          interactionsTools.push({
            type: 'mcp_server',
            ...(args.name != null ? { name: args.name as string } : {}),
            ...(args.url != null ? { url: args.url as string } : {}),
            ...(args.headers != null
              ? { headers: args.headers as Record<string, string> }
              : {}),
            ...(args.allowedTools != null
              ? { allowed_tools: args.allowedTools as Array<unknown> }
              : {}),
          });
          break;
        }
        case 'google.retrieval': {
          const vertexAiSearchConfig =
            (args.vertexAiSearchConfig as
              | { datastores?: Array<string>; engine?: string }
              | undefined) ?? undefined;
          interactionsTools.push({
            type: 'retrieval',
            ...(args.retrievalTypes != null
              ? {
                  retrieval_types:
                    args.retrievalTypes as Array<'vertex_ai_search'>,
                }
              : { retrieval_types: ['vertex_ai_search'] }),
            ...(vertexAiSearchConfig != null
              ? { vertex_ai_search_config: vertexAiSearchConfig }
              : {}),
          });
          break;
        }
        default: {
          toolWarnings.push({
            type: 'unsupported',
            feature: `provider-defined tool ${tool.id}`,
            details: `provider-defined tool ${tool.id} is not supported by google.interactions; tool dropped.`,
          });
          break;
        }
      }
      continue;
    }

    toolWarnings.push({
      type: 'unsupported',
      feature: `tool of type ${(tool as { type: string }).type}`,
      details:
        'Only function tools and google.* provider-defined tools are supported by google.interactions; tool dropped.',
    });
  }

  /*
   * `tool_choice` on the Interactions API governs function calling only -- the
   * API rejects requests with `tool_choice` set when no `function` tools are
   * present (`{"error":{"message":"Function calling config is set without
   * function_declarations."}}`). Drop `tool_choice` when the resolved tool
   * list is empty or contains no function tools.
   */
  const hasFunctionTool = interactionsTools.some(t => t.type === 'function');

  let mappedToolChoice: GoogleInteractionsToolChoice | undefined;
  if (toolChoice != null && hasFunctionTool) {
    switch (toolChoice.type) {
      case 'auto':
        mappedToolChoice = 'auto';
        break;
      case 'required':
        mappedToolChoice = 'any';
        break;
      case 'none':
        mappedToolChoice = 'none';
        break;
      case 'tool':
        mappedToolChoice = {
          allowed_tools: {
            mode: 'validated',
            tools: [toolChoice.toolName],
          },
        };
        break;
    }
  }

  return {
    tools: interactionsTools.length > 0 ? interactionsTools : undefined,
    toolChoice: mappedToolChoice,
    toolWarnings,
  };
}
