import type { LanguageModelV2File } from './language-model-v2-file';
import type { LanguageModelV2Reasoning } from './language-model-v2-reasoning';
import type { LanguageModelV2Source } from './language-model-v2-source';
import type { LanguageModelV2Text } from './language-model-v2-text';
import type { LanguageModelV2ToolCall } from './language-model-v2-tool-call';
import type { LanguageModelV2ToolResult } from './language-model-v2-tool-result';

export type LanguageModelV2Content =
  | LanguageModelV2Text
  | LanguageModelV2Reasoning
  | LanguageModelV2File
  | LanguageModelV2Source
  | LanguageModelV2ToolCall
  | LanguageModelV2ToolResult;
