import { openaiShellSkillsAgent } from '@/agent/openai/shell-skills-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiShellSkillsAgent,
    uiMessages: body.messages,
  });
}
