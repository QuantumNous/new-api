import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';
import type { LanguageModelV4CustomContent } from './language-model-v4-custom-content';
import type { LanguageModelV4File } from './language-model-v4-file';
import type { LanguageModelV4FinishReason } from './language-model-v4-finish-reason';
import type { LanguageModelV4ReasoningFile } from './language-model-v4-reasoning-file';
import type { LanguageModelV4ResponseMetadata } from './language-model-v4-response-metadata';
import type { LanguageModelV4Source } from './language-model-v4-source';
import type { LanguageModelV4ToolApprovalRequest } from './language-model-v4-tool-approval-request';
import type { LanguageModelV4ToolCall } from './language-model-v4-tool-call';
import type { LanguageModelV4ToolResult } from './language-model-v4-tool-result';
import type { LanguageModelV4Usage } from './language-model-v4-usage';

export type LanguageModelV4StreamPart =
  // Text blocks:
  | {
      type: 'text-start';
      providerMetadata?: SharedV4ProviderMetadata;
      id: string;
    }
  | {
      type: 'text-delta';
      id: string;
      providerMetadata?: SharedV4ProviderMetadata;
      delta: string;
    }
  | {
      type: 'text-end';
      providerMetadata?: SharedV4ProviderMetadata;
      id: string;
    }

  // Reasoning blocks:
  | {
      type: 'reasoning-start';
      providerMetadata?: SharedV4ProviderMetadata;
      id: string;
    }
  | {
      type: 'reasoning-delta';
      id: string;
      providerMetadata?: SharedV4ProviderMetadata;
      delta: string;
    }
  | {
      type: 'reasoning-end';
      id: string;
      providerMetadata?: SharedV4ProviderMetadata;
    }

  // Tool calls and results:
  | {
      type: 'tool-input-start';
      id: string;
      toolName: string;
      providerMetadata?: SharedV4ProviderMetadata;
      providerExecuted?: boolean;
      dynamic?: boolean;
      title?: string;
    }
  | {
      type: 'tool-input-delta';
      id: string;
      delta: string;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | {
      type: 'tool-input-end';
      id: string;
      providerMetadata?: SharedV4ProviderMetadata;
    }
  | LanguageModelV4ToolApprovalRequest
  | LanguageModelV4ToolCall
  | LanguageModelV4ToolResult
  | LanguageModelV4CustomContent

  // Files and sources:
  | LanguageModelV4File
  | LanguageModelV4ReasoningFile
  | LanguageModelV4Source

  // stream start event with warnings for the call, e.g. unsupported settings:
  | {
      type: 'stream-start';
      warnings: Array<SharedV4Warning>;
    }

  // metadata for the response.
  // separate stream part so it can be sent once it is available.
  | ({ type: 'response-metadata' } & LanguageModelV4ResponseMetadata)

  // metadata that is available after the stream is finished:
  | {
      type: 'finish';
      usage: LanguageModelV4Usage;
      finishReason: LanguageModelV4FinishReason;
      providerMetadata?: SharedV4ProviderMetadata;
    }

  // raw chunks if enabled
  | {
      type: 'raw';
      rawValue: unknown;
    }

  // error parts are streamed, allowing for multiple errors
  | {
      type: 'error';
      error: unknown;
    };
