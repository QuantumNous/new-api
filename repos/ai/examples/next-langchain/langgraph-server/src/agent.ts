/**
 * LangGraph Development Server Agent
 *
 * This is a simple example agent using LangChain's `createAgent` for demonstration.
 * The LangGraph CLI can serve ANY LangGraph application, including:
 *
 * - Simple agents built with `createAgent` (like this one)
 * - Complex multi-agent workflows with custom StateGraph
 * - RAG pipelines with retrieval nodes
 * - Human-in-the-loop workflows with interrupt points
 * - Custom graphs with persistence and memory
 *
 * To create more advanced agents, you can use the low-level LangGraph APIs:
 *
 * @example Custom StateGraph
 * ```typescript
 * import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
 *
 * const workflow = new StateGraph(MessagesAnnotation)
 *   .addNode('agent', callModel)
 *   .addNode('tools', toolNode)
 *   .addEdge(START, 'agent')
 *   .addConditionalEdges('agent', shouldContinue)
 *   .addEdge('tools', 'agent');
 *
 * export const graph = workflow.compile();
 * ```
 *
 * @see https://langchain-ai.github.io/langgraph/ for LangGraph documentation
 */

import { createAgent } from 'langchain';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define a simple weather tool
const weatherTool = tool(
  async ({ city }: { city: string }) => {
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy', 'snowy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temperature = Math.floor(Math.random() * 30) + 50;
    return `The weather in ${city} is currently ${condition} with a temperature of ${temperature}°F.`;
  },
  {
    name: 'get_weather',
    description: 'Get the current weather in a given city',
    schema: z.object({
      city: z.string().describe('The city to get weather for'),
    }),
  },
);

// Define a calculator tool
const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    try {
      // Simple safe eval for basic math
      const result = Function(`"use strict"; return (${expression})`)();
      return `The result of ${expression} is ${result}`;
    } catch {
      return `Could not evaluate expression: ${expression}`;
    }
  },
  {
    name: 'calculator',
    description: 'Perform basic mathematical calculations',
    schema: z.object({
      expression: z
        .string()
        .describe(
          'The mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
        ),
    }),
  },
);

// Create the agent using LangChain's createAgent
// This is the simplest way to create an agent with tools
export const graph = createAgent({
  model: 'openai:gpt-4o-mini',
  tools: [weatherTool, calculatorTool],
  systemPrompt: `You are a helpful assistant with access to weather and calculator tools.
When asked about weather, use the get_weather tool.
When asked to do math, use the calculator tool.
Always be friendly and helpful in your responses.`,
});
