/**
 * Example demonstrating Gateway timeout error handling
 *
 * This example uses undici with an extremely short timeout (1ms) to trigger
 * a timeout error. The Gateway SDK will catch this and provide a helpful
 * error message with troubleshooting guidance.
 *
 * Prerequisites:
 * - Set AI_GATEWAY_API_KEY environment variable
 *   (See .env.example for setup instructions)
 *
 * Run: pnpm tsx src/generate-text/gateway/timeout.ts
 */
import { createGateway, generateText } from 'ai';
import { Agent, fetch as undiciFetch } from 'undici';
import { run } from '../../lib/run';

run(async () => {
  try {
    // Create an undici Agent with very short timeouts
    // bodyTimeout applies to receiving the entire response body
    const agent = new Agent({
      headersTimeout: 1, // 1ms - will timeout waiting for headers
      bodyTimeout: 1, // 1ms - will timeout reading response body
    });

    // Create custom fetch using undici with the configured agent
    const customFetch = (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      return undiciFetch(url as Parameters<typeof undiciFetch>[0], {
        ...(options as any),
        dispatcher: agent,
      }) as Promise<Response>;
    };

    // Create gateway provider with custom fetch
    const gateway = createGateway({
      fetch: customFetch,
    });

    console.log('Making request with 1ms timeout...');
    console.log(
      'This should timeout immediately and show the timeout error handling.\n',
    );

    const { text, usage } = await generateText({
      model: gateway('anthropic/claude-3.5-sonnet'),
      prompt:
        'Write a detailed essay about the history of artificial intelligence, covering major milestones from the 1950s to present day.',
    });

    console.log('Success! Response received:');
    console.log(text);
    console.log();
    console.log('Usage:', usage);
  } catch (error) {
    console.error(
      '╔════════════════════════════════════════════════════════════════╗',
    );
    console.error(
      '║                    TIMEOUT ERROR CAUGHT                        ║',
    );
    console.error(
      '╚════════════════════════════════════════════════════════════════╝\n',
    );
    console.error('Error Name:', (error as Error).name);
    console.error('Error Type:', (error as any).type);
    console.error('Status Code:', (error as any).statusCode);
    console.error('Error Code:', (error as any).code);
    console.error('\nError Message:');
    console.error('─'.repeat(70));
    console.error((error as Error).message);
    console.error('─'.repeat(70));

    // Log the cause to see the original undici error
    if ((error as any).cause) {
      console.error('\n📋 Original Error (cause):');
      console.error('  Name:', ((error as any).cause as Error).name);
      console.error('  Code:', ((error as any).cause as any).code);
      console.error('  Message:', ((error as any).cause as Error).message);
      console.error(
        '  Constructor:',
        ((error as any).cause as Error).constructor.name,
      );
    }
  }
});
