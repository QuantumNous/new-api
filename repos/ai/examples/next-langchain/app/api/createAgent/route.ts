import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { createAgent } from 'langchain';
import { ChatOpenAI, tools } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { z } from 'zod';

/**
 * Allow streaming responses up to 60 seconds for image generation
 */
export const maxDuration = 60;

/**
 * The model to use for the agent
 * GPT-5 supports reasoning tokens which will be displayed in the UI
 */
const model = new ChatOpenAI({
  model: 'gpt-5',
  reasoning: {
    effort: 'low', // 'low' | 'medium' | 'high' - controls reasoning depth
    summary: 'auto', // Enable reasoning summary output for streaming
  },
});

/**
 * Image generation tool configuration
 * Supports various sizes, quality levels, and output formats
 */
const imageGenerationTool = tools.imageGeneration({
  size: '1024x1024',
  quality: 'high',
  outputFormat: 'png',
});

/**
 * Weather tool - simulates getting weather information
 */
const weatherTool = tool(
  async ({ city, units = 'fahrenheit' }) => {
    // Simulated weather data
    const weatherData: Record<string, { temp: number; condition: string }> = {
      'new york': { temp: 72, condition: 'Partly cloudy' },
      'los angeles': { temp: 85, condition: 'Sunny' },
      london: { temp: 58, condition: 'Overcast with light rain' },
      tokyo: { temp: 68, condition: 'Clear skies' },
      paris: { temp: 64, condition: 'Mild with scattered clouds' },
      sydney: { temp: 75, condition: 'Warm and sunny' },
    };

    const cityLower = city.toLowerCase();
    const data = weatherData[cityLower] || { temp: 70, condition: 'Unknown' };

    const temp =
      units === 'celsius' ? Math.round(((data.temp - 32) * 5) / 9) : data.temp;
    const unit = units === 'celsius' ? '°C' : '°F';

    /**
     * artificial delay to simulate tool execution time
     */
    await new Promise(resolve =>
      setTimeout(resolve, Math.floor(Math.random() * 1000)),
    );

    return `Weather in ${city}: ${temp}${unit}, ${data.condition}`;
  },
  {
    name: 'get_weather',
    description: 'Get the current weather in a city',
    schema: z.object({
      city: z.string().describe('The city name to get weather for'),
      units: z
        .enum(['fahrenheit', 'celsius'])
        .optional()
        .describe('Temperature units'),
    }),
  },
);

/**
 * Wikipedia search tool - simulates searching Wikipedia
 */
const wikiSearchTool = tool(
  async ({ query }) => {
    // Simulated Wikipedia search results
    const results: Record<string, string> = {
      python:
        'Python is a high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation.',
      javascript:
        'JavaScript is a programming language and core technology of the Web, alongside HTML and CSS. 99% of websites use JavaScript on the client side.',
      'artificial intelligence':
        'Artificial intelligence (AI) is the capability of computational systems to perform tasks typically associated with human intelligence, such as learning, reasoning, problem-solving, and perception.',
      'machine learning':
        'Machine learning (ML) is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.',
      langchain:
        'LangChain is a framework for developing applications powered by large language models (LLMs). It provides tools for prompt management, chains, agents, and memory.',
    };

    const queryLower = query.toLowerCase();
    for (const [key, value] of Object.entries(results)) {
      if (queryLower.includes(key)) {
        return `Wikipedia summary for "${query}": ${value}`;
      }
    }

    return `No Wikipedia results found for "${query}". Try searching for: Python, JavaScript, Artificial Intelligence, Machine Learning, or LangChain.`;
  },
  {
    name: 'wiki_search',
    description:
      'Search Wikipedia for information on a topic. Returns a brief summary.',
    schema: z.object({
      query: z.string().describe('The topic to search for on Wikipedia'),
    }),
  },
);

/**
 * Date/Time tool - gets current date and time information
 */
const dateTimeTool = tool(
  async ({ timezone = 'UTC', format = 'full' }) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: format === 'full' ? 'long' : undefined,
      year: 'numeric',
      month: format === 'full' ? 'long' : 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: format === 'full' ? '2-digit' : undefined,
    };

    /**
     * artificial delay to simulate tool execution time
     */
    await new Promise(resolve =>
      setTimeout(resolve, Math.floor(Math.random() * 1000)),
    );

    try {
      const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
      return `Current date and time in ${timezone}: ${formatted}`;
    } catch {
      return `Error: Invalid timezone "${timezone}". Using UTC: ${now.toUTCString()}`;
    }
  },
  {
    name: 'get_datetime',
    description:
      'Get the current date and time, optionally in a specific timezone',
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe(
          'IANA timezone (e.g., "America/New_York", "Europe/London", "Asia/Tokyo")',
        ),
      format: z
        .enum(['full', 'short'])
        .optional()
        .describe('Output format - full includes weekday and seconds'),
    }),
  },
);

/**
 * The LangChain agent with multiple tools including image generation
 */
const agent = createAgent({
  model,
  tools: [imageGenerationTool, weatherTool, wikiSearchTool, dateTimeTool],
  systemPrompt: `You are a helpful AI assistant with access to multiple tools.

Available tools:
1. **Image Generation**: Create images from text descriptions
2. **Weather**: Get current weather for any city
3. **Wikipedia Search**: Look up information on various topics
4. **Date/Time**: Get current date and time in any timezone

When responding:
- Think step-by-step about what tools you need
- Use multiple tools when needed to answer complex questions
- Provide helpful, detailed responses
- For image requests, be creative with prompts

Examples of things you can help with:
- "What's the weather in Tokyo and what time is it there?"
- "Tell me about machine learning and draw an illustration of a neural network"
- "Search for information about Python programming"`,
});

/**
 * The API route for the LangChain agent with multiple tools
 * @param req - The request object
 * @returns The response from the API
 */
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    /**
     * Convert AI SDK UIMessages to LangChain messages
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Stream from the LangChain agent with multiple tools
     * Note: Type assertion needed due to LangChain type version mismatch
     */
    const stream = await agent.stream(
      { messages: langchainMessages },
      { streamMode: ['values', 'messages'] },
    );

    /**
     * Convert the LangChain stream to UI message stream
     * Tool outputs and images will be included in the response
     */
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream as unknown as ReadableStream),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
