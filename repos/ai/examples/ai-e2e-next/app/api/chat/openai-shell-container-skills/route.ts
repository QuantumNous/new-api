import { openaiShellContainerSkillsAgent } from '@/agent/openai/shell-container-skills-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiShellContainerSkillsAgent,
    uiMessages: body.messages,
  });
}
