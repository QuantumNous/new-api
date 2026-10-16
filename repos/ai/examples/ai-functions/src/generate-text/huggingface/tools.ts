import { huggingFace } from '@ai-sdk/huggingface';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage, toolCalls, toolResults } = await generateText({
    model: huggingFace.responses('deepseek-ai/DeepSeek-V3-0324'),
    stopWhen: isStepCount(3),
    tools: {
      getWeather: tool({
        description: 'Get the current weather for a specific location',
        inputSchema: z.object({
          location: z
            .string()
            .describe('The city name, e.g., New York, London, Tokyo'),
        }),
        execute: async ({ location }) => {
          // Simulate weather API call
          const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
          const temperature = Math.floor(Math.random() * 30) + 50; // 50-80F
          const humidity = Math.floor(Math.random() * 50) + 30; // 30-80%

          return {
            location,
            temperature: `${temperature}°F`,
            condition:
              conditions[Math.floor(Math.random() * conditions.length)],
            humidity: `${humidity}%`,
            wind: `${Math.floor(Math.random() * 20) + 5} mph`,
          };
        },
      }),
    },
    prompt:
      'What is the weather in New York? Use the getWeather tool and tell me the results.',

    onStepFinish: step => {
      console.log('\n=== Step Completed ===');

      if (step.text) {
        console.log('Generated text:', step.text);
      }

      if (step.toolCalls.length > 0) {
        console.log('Tool calls made:');
        step.toolCalls.forEach(call => {
          console.log(`  - ${call.toolName}(${JSON.stringify(call.input)})`);
        });
      }

      if (step.toolResults.length > 0) {
        console.log('Tool results received:');
        step.toolResults.forEach(result => {
          console.log(`  - ${result.toolName}:`);
          console.log(`    ${JSON.stringify(result.output, null, 4)}`);
        });
      }

      console.log(`Finish reason: ${step.finishReason}`);
    },
  });

  console.log('\n=== FINAL RESULTS ===');
  console.log('Final text response:', text || '(no text generated)');

  console.log('\nAll tool calls:');
  toolCalls.forEach((call, i) => {
    console.log(`${i + 1}. ${call.toolName}(${JSON.stringify(call.input)})`);
  });

  console.log('\nAll tool results:');
  toolResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.toolName}:`);
    console.log(`   ${JSON.stringify(result.output, null, 4)}`);
  });

  console.log('\nUsage:', usage);
});
