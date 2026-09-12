/**
 * Example demonstrating Gateway timeout error handling for video generation
 *
 * This example uses undici with an extremely short timeout (1ms) to trigger
 * a timeout error. The Gateway SDK will catch this and provide a helpful
 * error message with troubleshooting guidance.
 *
 * Prerequisites:
 * - Set AI_GATEWAY_API_KEY environment variable
 *   (See .env.example for setup instructions)
 *
 * Run: pnpm tsx src/generate-video/gateway/timeout.ts
 */
import { createGateway, experimental_generateVideo } from 'ai';
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

    console.log('Making video generation request with 1ms timeout...');
    console.log(
      'This should timeout immediately and show the timeout error handling.\n',
    );

    const { videos } = await experimental_generateVideo({
      model: gateway.videoModel('google/veo-3.1-generate-001'),
      prompt: 'A resplendent quetzal flying through the rainforest',
    });

    console.log('Success! Video generated:');
    console.log('Number of videos:', videos.length);
    if (videos[0]) {
      console.log('Base64 length:', videos[0].base64.length);
      console.log('Media type:', videos[0].mediaType);
    }
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
