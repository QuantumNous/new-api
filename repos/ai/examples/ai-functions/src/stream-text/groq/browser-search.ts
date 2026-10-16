import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  try {
    const result = streamText({
      model: groq('openai/gpt-oss-120b'),
      prompt:
        'What happened in AI last week? Give me a concise summary of the most important events.',
      tools: {
        browser_search: groq.tools.browserSearch({}),
      },
      // Use required tool choice to ensure browser search is used
      toolChoice: 'required',
    });

    console.log('Starting browser search...\n');

    for await (const delta of result.stream) {
      switch (delta.type) {
        case 'text-delta': {
          process.stdout.write(delta.text);
          break;
        }
        case 'tool-call': {
          console.log(`\n[Tool Call] ${delta.toolName}`);
          break;
        }
        case 'tool-result': {
          console.log(`\n[Tool Result] ${delta.toolName} completed`);
          break;
        }
      }
    }

    console.log('\n\n--- Metadata ---');
    console.log('Usage:', await result.usage);
    console.log('Finish reason:', await result.finishReason);

    // Warnings about unsupported model usage
    const warnings = await result.warnings;
    if (warnings && warnings.length > 0) {
      console.log('Warnings:', warnings);
    }
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof Error && error.message.includes('Browser search')) {
      console.error("\nTip: Make sure you're using a supported model:");
      console.error('- openai/gpt-oss-20b');
      console.error('- openai/gpt-oss-120b');
    }
  }

  // Example showing what happens with unsupported model
  console.log('\n=== Example with unsupported model ===');

  const unsupportedResult = streamText({
    model: groq('gemma2-9b-it'), // Unsupported model
    prompt: 'Search for AI news',
    tools: {
      browser_search: groq.tools.browserSearch({}),
    },
  });

  const warnings = await unsupportedResult.warnings;
  console.log('Warnings for unsupported model:', warnings);
});
