import {
  openaiMCPApprovalAgent,
  type OpenAIMCPApprovalAgentUIMessage,
} from '@/agent/openai/mcp-approval-agent';
import { createAgentUIStreamResponse } from 'ai';

export const maxDuration = 60;

export type OpenAIResponsesMCPApprovalMessage = OpenAIMCPApprovalAgentUIMessage;

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiMCPApprovalAgent,
    uiMessages: body.messages,
  });
}
