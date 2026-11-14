import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
      model: amazonBedrock('anthropic.claude-3-haiku-20240307-v1:0'),
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 500,
      temperature: 0.7,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error('Bedrock API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Bedrock API failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
