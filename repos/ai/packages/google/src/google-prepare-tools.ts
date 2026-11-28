import {
  UnsupportedFunctionalityError,
  type LanguageModelV4CallOptions,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import { convertJSONSchemaToOpenAPISchema } from './convert-json-schema-to-openapi-schema';
import type { GoogleModelId } from './google-language-model-options';

export function prepareTools({
  tools,
  toolChoice,
  modelId,
  isVertexProvider = false,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
  modelId: GoogleModelId;
  isVertexProvider?: boolean;
}): {
  tools:
    | Array<
        | {
            functionDeclarations: Array<{
              name: string;
              description: string;
              parameters: unknown;
            }>;
          }
        | Record<string, any>
      >
    | undefined;
  toolConfig:
    | undefined
    | {
        functionCallingConfig?: {
          mode: 'AUTO' | 'NONE' | 'ANY' | 'VALIDATED';
          allowedFunctionNames?: string[];
          streamFunctionCallArguments?: boolean;
        };
        includeServerSideToolInvocations?: boolean;
      };
  toolWarnings: SharedV4Warning[];
} {
  // when the tools array is empty, change it to undefined to prevent errors:
  tools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV4Warning[] = [];

  const isLatest = (
    [
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
    ] as const satisfies GoogleModelId[]
  ).some(id => id === modelId);
  const isGemini2orNewer =
    modelId.includes('gemini-2') ||
    modelId.includes('gemini-3') ||
    modelId.includes('nano-banana') ||
    isLatest;
  const isGemini3orNewer = modelId.includes('gemini-3');
  const supportsFileSearch =
    modelId.includes('gemini-2.5') || modelId.includes('gemini-3');

  if (tools == null) {
    return { tools: undefined, toolConfig: undefined, toolWarnings };
  }

  // Check for mixed tool types and add warnings
  const hasFunctionTools = tools.some(tool => tool.type === 'function');
  const hasProviderTools = tools.some(tool => tool.type === 'provider');

  if (hasFunctionTools && hasProviderTools && !isGemini3orNewer) {
    toolWarnings.push({
      type: 'unsupported',
      feature: `combination of function and provider-defined tools`,
    });
  }

  if (hasProviderTools) {
    const googleTools: any[] = [];

    const ProviderTools = tools.filter(tool => tool.type === 'provider');
    ProviderTools.forEach(tool => {
      switch (tool.id) {
        case 'google.google_search':
          if (isGemini2orNewer) {
            googleTools.push({ googleSearch: { ...tool.args } });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details: 'Google Search requires Gemini 2.0 or newer.',
            });
          }
          break;
        case 'google.enterprise_web_search':
          if (isGemini2orNewer) {
            googleTools.push({ enterpriseWebSearch: {} });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details: 'Enterprise Web Search requires Gemini 2.0 or newer.',
            });
          }
          break;
        case 'google.url_context':
          if (isGemini2orNewer) {
            googleTools.push({ urlContext: {} });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details:
                'The URL context tool is not supported with other Gemini models than Gemini 2.',
            });
          }
          break;
        case 'google.code_execution':
          if (isGemini2orNewer) {
            googleTools.push({ codeExecution: {} });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details:
                'The code execution tool is not supported with other Gemini models than Gemini 2.',
            });
          }
          break;
        case 'google.file_search':
          if (supportsFileSearch) {
            googleTools.push({ fileSearch: { ...tool.args } });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details:
                'The file search tool is only supported with Gemini 2.5 models and Gemini 3 models.',
            });
          }
          break;
        case 'google.vertex_rag_store':
          if (isGemini2orNewer) {
            googleTools.push({
              retrieval: {
                vertex_rag_store: {
                  rag_resources: {
                    rag_corpus: tool.args.ragCorpus,
                  },
                  similarity_top_k: tool.args.topK as number | undefined,
                },
              },
            });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details:
                'The RAG store tool is not supported with other Gemini models than Gemini 2.',
            });
          }
          break;
        case 'google.google_maps':
          if (isGemini2orNewer) {
            googleTools.push({ googleMaps: {} });
          } else {
            toolWarnings.push({
              type: 'unsupported',
              feature: `provider-defined tool ${tool.id}`,
              details:
                'The Google Maps grounding tool is not supported with Gemini models other than Gemini 2 or newer.',
            });
          }
          break;
        default:
          toolWarnings.push({
            type: 'unsupported',
            feature: `provider-defined tool ${tool.id}`,
          });
          break;
      }
    });

    if (hasFunctionTools && isGemini3orNewer && googleTools.length > 0) {
      const functionDeclarations: Array<{
        name: string;
        description: string;
        parameters: unknown;
      }> = [];
      for (const tool of tools) {
        if (tool.type === 'function') {
          functionDeclarations.push({
            name: tool.name,
            description: tool.description ?? '',
            parameters: convertJSONSchemaToOpenAPISchema(tool.inputSchema),
          });
        }
      }

      const combinedToolConfig: {
        functionCallingConfig: {
          mode: 'VALIDATED' | 'ANY' | 'NONE';
          allowedFunctionNames?: string[];
        };
        includeServerSideToolInvocations?: true;
      } = {
        functionCallingConfig: { mode: 'VALIDATED' },
        ...(!isVertexProvider && {
          includeServerSideToolInvocations: true,
        }),
      };

      if (toolChoice != null) {
        switch (toolChoice.type) {
          case 'auto':
            break;
          case 'none':
            combinedToolConfig.functionCallingConfig = { mode: 'NONE' };
            break;
          case 'required':
            combinedToolConfig.functionCallingConfig = { mode: 'ANY' };
            break;
          case 'tool':
            combinedToolConfig.functionCallingConfig = {
              mode: 'ANY',
              allowedFunctionNames: [toolChoice.toolName],
            };
            break;
        }
      }

      return {
        tools: [...googleTools, { functionDeclarations }],
        toolConfig: combinedToolConfig,
        toolWarnings,
      };
    }

    return {
      tools: googleTools.length > 0 ? googleTools : undefined,
      toolConfig: undefined,
      toolWarnings,
    };
  }

  const functionDeclarations = [];
  let hasStrictTools = false;
  for (const tool of tools) {
    switch (tool.type) {
      case 'function':
        functionDeclarations.push({
          name: tool.name,
          description: tool.description ?? '',
          parameters: convertJSONSchemaToOpenAPISchema(tool.inputSchema),
        });
        if (tool.strict === true) {
          hasStrictTools = true;
        }
        break;
      default:
        toolWarnings.push({
          type: 'unsupported',
          feature: `function tool ${tool.name}`,
        });
        break;
    }
  }

  if (toolChoice == null) {
    return {
      tools: [{ functionDeclarations }],
      toolConfig: hasStrictTools
        ? { functionCallingConfig: { mode: 'VALIDATED' } }
        : undefined,
      toolWarnings,
    };
  }

  const type = toolChoice.type;

  switch (type) {
    case 'auto':
      return {
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: hasStrictTools ? 'VALIDATED' : 'AUTO',
          },
        },
        toolWarnings,
      };
    case 'none':
      return {
        tools: [{ functionDeclarations }],
        toolConfig: { functionCallingConfig: { mode: 'NONE' } },
        toolWarnings,
      };
    case 'required':
      return {
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: hasStrictTools ? 'VALIDATED' : 'ANY',
          },
        },
        toolWarnings,
      };
    case 'tool':
      return {
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: hasStrictTools ? 'VALIDATED' : 'ANY',
            allowedFunctionNames: [toolChoice.toolName],
          },
        },
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
