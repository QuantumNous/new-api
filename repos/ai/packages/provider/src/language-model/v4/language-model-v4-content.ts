import type { LanguageModelV4CustomContent } from './language-model-v4-custom-content';
import type { LanguageModelV4File } from './language-model-v4-file';
import type { LanguageModelV4Reasoning } from './language-model-v4-reasoning';
import type { LanguageModelV4ReasoningFile } from './language-model-v4-reasoning-file';
import type { LanguageModelV4Source } from './language-model-v4-source';
import type { LanguageModelV4Text } from './language-model-v4-text';
import type { LanguageModelV4ToolApprovalRequest } from './language-model-v4-tool-approval-request';
import type { LanguageModelV4ToolCall } from './language-model-v4-tool-call';
import type { LanguageModelV4ToolResult } from './language-model-v4-tool-result';

export type LanguageModelV4Content =
  | LanguageModelV4Text
  | LanguageModelV4Reasoning
  | LanguageModelV4CustomContent
  | LanguageModelV4ReasoningFile
  | LanguageModelV4File
  | LanguageModelV4ToolApprovalRequest
  | LanguageModelV4Source
  | LanguageModelV4ToolCall
  | LanguageModelV4ToolResult;
