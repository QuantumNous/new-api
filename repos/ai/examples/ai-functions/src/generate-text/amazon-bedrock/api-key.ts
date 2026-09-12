import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  console.log('=== Amazon Bedrock API Key Authentication Example ===\n');

  // Example 1: Using API key via environment variable (AWS_BEARER_TOKEN_BEDROCK)
  // This is the recommended approach for production applications
  console.log(
    'Example 1: Using API key from environment variable (AWS_BEARER_TOKEN_BEDROCK)',
  );
  try {
    const result1 = await generateText({
      model: amazonBedrock('anthropic.claude-3-haiku-20240307-v1:0'),
      prompt: 'Write a haiku about API keys.',
      // Note: API key is automatically loaded from AWS_BEARER_TOKEN_BEDROCK environment variable
    });

    console.log('Generated haiku:', result1.text);
    console.log('Token usage:', result1.usage);
    console.log('Finish reason:', result1.finishReason);
  } catch (error) {
    console.log(
      'Error (expected if AWS_BEARER_TOKEN_BEDROCK not set):',
      (error as Error).message,
    );
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 2: Using API key directly in provider configuration
  // This demonstrates how to pass the API key directly (not recommended for production)
  console.log('Example 2: Using API key directly in provider configuration');

  // For demonstration purposes - in real applications, load from secure environment
  const exampleApiKey =
    process.env.AWS_BEARER_TOKEN_BEDROCK || 'your-api-key-here';

  try {
    // Create provider with explicit API key
    const { createAmazonBedrock } = await import('@ai-sdk/amazon-bedrock');
    const bedrockWithApiKey = createAmazonBedrock({
      apiKey: exampleApiKey,
      region: 'us-east-1', // Optional: specify region
    });

    const result2 = await generateText({
      model: bedrockWithApiKey('anthropic.claude-3-haiku-20240307-v1:0'),
      prompt: 'Explain the benefits of API key authentication over AWS SigV4.',
    });

    console.log('Generated explanation:', result2.text);
    console.log('Token usage:', result2.usage);
  } catch (error) {
    console.log(
      'Error (expected if API key not valid):',
      (error as Error).message,
    );
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 3: Comparison with SigV4 authentication
  console.log('Example 3: Comparison - API Key vs SigV4 Authentication');

  console.log(`
API Key Authentication (Simpler):
- Set AWS_BEARER_TOKEN_BEDROCK environment variable
- No need for AWS credentials (access key, secret key, session token)
- Simpler configuration and setup
- Bearer token authentication in HTTP headers

SigV4 Authentication (Traditional AWS):
- Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- Optional AWS_SESSION_TOKEN for temporary credentials
- More complex request signing process
- Full AWS IAM integration and policies

API Key authentication is ideal for:
- Simplified deployment scenarios
- Applications that don't need full AWS IAM integration
- Easier credential management
- Reduced complexity in authentication flow
  `);

  // Example 4: Error handling and fallback
  console.log('Example 4: Demonstrating fallback behavior');

  try {
    // This will use API key if AWS_BEARER_TOKEN_BEDROCK is set,
    // otherwise fall back to SigV4 authentication
    const result4 = await generateText({
      model: amazonBedrock('anthropic.claude-3-haiku-20240307-v1:0'),
      prompt: 'Write a short poem about authentication methods.',
    });

    console.log('Generated poem:', result4.text);
    console.log(
      'Authentication method used: API Key or SigV4 (automatic fallback)',
    );
  } catch (error) {
    console.log('Error:', (error as Error).message);
    console.log(
      'Make sure either AWS_BEARER_TOKEN_BEDROCK or AWS credentials are configured',
    );
  }
});
