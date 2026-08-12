import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createApplyPatchExecutor } from '@/lib/apply-patch-file-editor';

// Create workspace directory
const workspaceRoot = path.join(process.cwd(), 'workspace');

// Ensure workspace directory exists
async function ensureWorkspaceExists() {
  try {
    await fs.mkdir(workspaceRoot, { recursive: true });
  } catch (error) {}
}

ensureWorkspaceExists();

export const openaiApplyPatchAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.1'),
  tools: {
    apply_patch: openai.tools.applyPatch({
      execute: createApplyPatchExecutor(workspaceRoot),
    }),
  },
  reasoning: 'medium',
  providerOptions: {
    openai: {
      reasoningSummary: 'detailed',
    } satisfies OpenAILanguageModelResponsesOptions,
  },
});

export type OpenAIApplyPatchMessage = InferAgentUIMessage<
  typeof openaiApplyPatchAgent
>;
