import type { ToolSet } from '@ai-sdk/provider-utils';
import type {
  HARNESS_V1_BUILTIN_TOOLS,
  HarnessV1,
  HarnessV1BuiltinTool,
  HarnessV1BuiltinToolName,
  HarnessV1BuiltinToolUseKind,
  HarnessV1ContinueTurnOptions,
  HarnessV1ContinueTurnState,
  HarnessV1LifecycleState,
  HarnessV1PendingToolApproval,
  HarnessV1PermissionMode,
  HarnessV1Prompt,
  HarnessV1PromptControl,
  HarnessV1PromptTurnOptions,
  HarnessV1ResumeSessionState,
  HarnessV1Session,
  HarnessV1Skill,
  HarnessV1StartOptions,
  HarnessV1StreamPart,
  HarnessV1ToolSpec,
} from '../v1';

export type HarnessAgentAdapter<TBuiltinTools extends ToolSet = ToolSet> =
  HarnessV1<TBuiltinTools>;

export type HarnessAgentBuiltinTool<
  INPUT = unknown,
  OUTPUT = unknown,
> = HarnessV1BuiltinTool<INPUT, OUTPUT>;
export type HarnessAgentBuiltinToolName = HarnessV1BuiltinToolName;
export type HarnessAgentBuiltinToolUseKind = HarnessV1BuiltinToolUseKind;
export type HarnessAgentBuiltinTools = typeof HARNESS_V1_BUILTIN_TOOLS;

export type HarnessAgentStartOptions = HarnessV1StartOptions;
export type HarnessAgentAdapterSession = HarnessV1Session;
export type HarnessAgentPrompt = HarnessV1Prompt;
export type HarnessAgentPromptControl = HarnessV1PromptControl;
export type HarnessAgentPromptTurnOptions = HarnessV1PromptTurnOptions;
export type HarnessAgentContinueTurnOptions = HarnessV1ContinueTurnOptions;
export type HarnessAgentStreamPart = HarnessV1StreamPart;
export type HarnessAgentToolSpec = HarnessV1ToolSpec;

export type HarnessAgentLifecycleState = HarnessV1LifecycleState;
export type HarnessAgentResumeSessionState = HarnessV1ResumeSessionState;
export type HarnessAgentContinueTurnState = HarnessV1ContinueTurnState;
export type HarnessAgentPendingToolApproval = HarnessV1PendingToolApproval;

export type HarnessAgentSkill = HarnessV1Skill;
export type HarnessAgentPermissionMode = HarnessV1PermissionMode;
