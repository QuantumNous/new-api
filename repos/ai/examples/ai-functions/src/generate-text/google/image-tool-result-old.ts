import { google } from '@ai-sdk/google';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../../lib/run';

async function fileToBase64(filePath: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filePath);
  return fileBuffer.toString('base64');
}

const imageAnalysisTool = tool({
  description: 'Give the image ',
  inputSchema: z.object({}),
  execute: async ({}) => {
    try {
      const imagePath = path.join(__dirname, '../../../data/comic-cat.png');
      const base64Image = await fileToBase64(imagePath);

      return {
        success: true,
        description: 'Image fetched successfully',
        base64Image,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },

  toModelOutput({ output }) {
    return {
      type: 'content',
      value: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: output.base64Image! },
        },
      ],
    };
  },
});

run(async () => {
  console.log(
    '🔍 Testing Google model image analysis with tool-returned images...\n',
  );

  const result = await generateText({
    model: google('gemini-2.5-flash'),
    tools: {
      analyzeImage: imageAnalysisTool,
    },
    stopWhen: isStepCount(2),
    prompt: `Whats in this image?`,
  });

  console.log('📋 Analysis Result: \n');
  console.log('='.repeat(60));
  console.log(`${JSON.stringify(result.text, null, 2)}\n`);
  // console.log(JSON.stringify(result.steps, null, 2));

  if (result.toolCalls && result.toolCalls.length > 0) {
    console.log('🔧 Tool Calls Made: \n');
    result.toolCalls.forEach((call, index) => {
      console.log(`${index + 1}. ${call.toolName}:`);
      console.log(`   Input: ${JSON.stringify(call.input, null, 2)}`);
    });
    console.log();
  }

  console.log('📊 Usage: \n');
  console.log(`Input tokens: ${result.usage.inputTokens}`);
  console.log(`Output tokens: ${result.usage.outputTokens}`);
  console.log(`Total tokens: ${result.usage.totalTokens}`);
});
