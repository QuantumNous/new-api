import type { LanguageModelV3File } from './language-model-v3-file';
import type { LanguageModelV3Reasoning } from './language-model-v3-reasoning';
import type { LanguageModelV3Source } from './language-model-v3-source';
import type { LanguageModelV3Text } from './language-model-v3-text';
import type { LanguageModelV3ToolApprovalRequest } from './language-model-v3-tool-approval-request';
import type { LanguageModelV3ToolCall } from './language-model-v3-tool-call';
import type { LanguageModelV3ToolResult } from './language-model-v3-tool-result';

export type LanguageModelV3Content =
  | LanguageModelV3Text
  | LanguageModelV3Reasoning
  | LanguageModelV3File
  | LanguageModelV3ToolApprovalRequest
  | LanguageModelV3Source
  | LanguageModelV3ToolCall
  | LanguageModelV3ToolResult;
