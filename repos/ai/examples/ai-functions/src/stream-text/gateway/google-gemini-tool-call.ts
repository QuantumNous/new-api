import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';

/**
 * Verification for https://github.com/vercel/ai/issues/11413
 *
 * Simulates gateway cross-provider failover scenarios between Google AI Studio
 * and Vertex AI. Both providers share the same GoogleLanguageModel
 * but store thoughtSignature under different providerOptions keys ("google"
 * vs "vertex").
 *
 * The fix makes convertToGoogleMessages check both namespaces:
 *   - Primary: providerOptions[providerOptionsName]
 *   - Fallback: the other namespace ("vertex" or "google")
 *
 * We test three scenarios:
 *   A) Normal: thoughtSignature under "google" key, Google provider (baseline)
 *   B) Vertex → Google failover: thoughtSignature under "vertex" key, Google provider
 *   C) Google → Vertex failover: thoughtSignature under "google" key, Vertex provider
 */
async function main() {
  console.log('Issue #11413: Verifying bidirectional gateway failover fix\n');

  const vertex = createGoogleVertex();

  const weatherTool = tool({
    description: 'Get the weather for a location',
    inputSchema: z.object({
      location: z.string().describe('The location to get weather for'),
    }),
    execute: async ({ location }) => ({
      location,
      temperature: 72,
      condition: 'sunny',
    }),
  });

  // --- Turn 1: Get a real response with thoughtSignature ---
  console.log('=== Turn 1: Get response with thoughtSignature ===\n');

  const turn1 = streamText({
    model: google('gemini-3.1-pro-preview'),
    tools: { weather: weatherTool },
    prompt: 'What is the weather in San Francisco?',
    stopWhen: isStepCount(2),
  });

  for await (const chunk of turn1.stream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text);
    }
  }

  const response1 = await turn1.response;

  let hasThoughtSignature = false;
  for (const msg of response1.messages) {
    if (msg.role === 'assistant' && typeof msg.content !== 'string') {
      for (const part of msg.content) {
        if (
          part.type === 'tool-call' &&
          part.providerOptions?.google?.thoughtSignature
        ) {
          hasThoughtSignature = true;
          const sig = String(part.providerOptions.google.thoughtSignature);
          console.log(
            `\nTurn 1 tool-call thoughtSignature: ${sig.substring(0, 40)}... (${sig.length} chars)`,
          );
        }
      }
    }
  }
  if (!hasThoughtSignature) {
    console.log(
      '\nTurn 1 did not produce thoughtSignature — cannot test failover',
    );
    process.exit(0);
  }

  // --- Scenario A: Normal (thoughtSignature under "google" key) ---
  console.log(
    '\n\n=== Scenario A: Normal — thoughtSignature under "google" key ===\n',
  );

  try {
    const scenarioA = streamText({
      model: google('gemini-3.1-pro-preview'),
      tools: { weather: weatherTool },
      messages: [
        { role: 'user', content: 'What is the weather in San Francisco?' },
        ...response1.messages,
        { role: 'user', content: 'What about New York?' },
      ],
      stopWhen: isStepCount(2),
    });

    for await (const chunk of scenarioA.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }

    console.log('\n✓ Scenario A succeeded (expected)\n');
  } catch (error: any) {
    console.error('\n✗ Scenario A FAILED (unexpected):', error.message);
  }

  // --- Scenario B: Vertex → Google failover ---
  console.log(
    '=== Scenario B: Vertex → Google failover — thoughtSignature under "vertex" key ===\n',
  );

  const vertexKeyMessages = response1.messages.map(msg => {
    if (
      (msg.role === 'assistant' || msg.role === 'tool') &&
      typeof msg.content !== 'string'
    ) {
      return {
        ...msg,
        content: msg.content.map(part => {
          if ('providerOptions' in part && part.providerOptions?.google) {
            const { google: googleOpts, ...rest } = part.providerOptions;
            return {
              ...part,
              providerOptions: { ...rest, vertex: googleOpts },
            };
          }
          return part;
        }),
      };
    }
    return msg;
  });

  console.log(
    'Messages rewritten: providerOptions "google" → "vertex" (simulates Vertex→Google failover)',
  );
  console.log(
    'Google provider should find thoughtSignature via vertex fallback\n',
  );

  try {
    const scenarioB = streamText({
      model: google('gemini-3.1-pro-preview'),
      tools: { weather: weatherTool },
      messages: [
        { role: 'user', content: 'What is the weather in San Francisco?' },
        ...(vertexKeyMessages as any),
        { role: 'user', content: 'What about New York?' },
      ],
      stopWhen: isStepCount(2),
    });

    for await (const chunk of scenarioB.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }

    console.log('\n✓ Scenario B succeeded — Vertex→Google failover works!\n');
  } catch (error: any) {
    console.error('\n✗ Scenario B FAILED:');
    console.error('  Error:', error.message?.substring(0, 200));
    console.log();
  }

  // --- Scenario C: Google → Vertex failover ---
  console.log(
    '=== Scenario C: Google → Vertex failover — thoughtSignature under "google" key ===\n',
  );

  if (!process.env.GOOGLE_VERTEX_API_KEY) {
    console.log(
      '⏭ Scenario C skipped — GOOGLE_VERTEX_API_KEY not set\n' +
        '  Set this env var to test the Google→Vertex failover direction.\n' +
        '  (This direction was already working before the fix and is covered by unit tests.)\n',
    );
  } else {
    console.log('Messages kept as-is with providerOptions under "google" key');
    console.log(
      'Vertex provider should find thoughtSignature via google fallback\n',
    );

    try {
      const scenarioC = streamText({
        model: vertex('gemini-3.1-pro-preview'),
        tools: { weather: weatherTool },
        messages: [
          { role: 'user', content: 'What is the weather in San Francisco?' },
          ...response1.messages,
          { role: 'user', content: 'What about New York?' },
        ],
        stopWhen: isStepCount(2),
      });

      for await (const chunk of scenarioC.stream) {
        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.text);
        }
      }

      console.log('\n✓ Scenario C succeeded — Google→Vertex failover works!\n');
    } catch (error: any) {
      console.error('\n✗ Scenario C FAILED:');
      console.error('  Error:', error.message?.substring(0, 200));
      console.log();
    }
  }
}

main().catch(console.error);
