import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { z } from 'zod';
import { tool, type ToolRuntime } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from '@langchain/langgraph';

import { ToolNode } from '@langchain/langgraph/prebuilt';
import type { ProgressData, StatusData, FileStatusData } from '../../types';

/**
 * Allow streaming responses up to 60 seconds
 */
export const maxDuration = 60;

/**
 * The model to use for the agent
 */
const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
});

/**
 * Data analysis tool - demonstrates custom streaming events
 * Emits progress updates during execution using typed custom events
 */
const analyzeDataTool = tool(
  async (
    { dataSource, analysisType },
    config: ToolRuntime,
  ): Promise<string> => {
    const steps = [
      { step: 'connecting', message: `Connecting to ${dataSource}...` },
      { step: 'fetching', message: 'Fetching data records...' },
      { step: 'processing', message: `Running ${analysisType} analysis...` },
      { step: 'generating', message: 'Generating insights...' },
    ];

    // Use a unique ID for this analysis to make progress parts persistent
    // Parts with an 'id' field are added to message.parts (not transient)
    const analysisId = `analysis-${Date.now()}`;

    for (let i = 0; i < steps.length; i++) {
      // Emit progress events with typed custom data
      // The adapter will convert { type: 'progress', ... } to data-progress
      // The 'id' field makes this part persistent (added to message.parts)
      config.writer?.({
        type: 'progress',
        id: analysisId, // Same ID to update the progress in place
        step: steps[i].step,
        message: steps[i].message,
        progress: Math.round(((i + 1) / steps.length) * 100),
        totalSteps: steps.length,
        currentStep: i + 1,
      } satisfies ProgressData);

      // Simulate processing time
      await new Promise(resolve =>
        setTimeout(resolve, 500 + Math.random() * 500),
      );
    }

    // Emit completion event with unique ID
    config.writer?.({
      type: 'status',
      id: `${analysisId}-status`,
      status: 'complete',
      message: 'Analysis finished successfully',
    } satisfies StatusData);

    // Return the result to the LLM
    const results = {
      dataSource,
      analysisType,
      recordsProcessed: Math.floor(Math.random() * 10000) + 1000,
      insights: [
        'Key trend: 23% increase in Q4',
        'Anomaly detected in region B',
        'Correlation found between X and Y metrics',
      ],
      confidence: 0.94,
    };

    return JSON.stringify(results, null, 2);
  },
  {
    name: 'analyze_data',
    description:
      'Analyze data from various sources. Streams progress updates during analysis.',
    schema: z.object({
      dataSource: z
        .enum(['sales', 'inventory', 'customers', 'transactions'])
        .describe('The data source to analyze'),
      analysisType: z
        .enum(['trends', 'anomalies', 'correlations', 'summary'])
        .describe('The type of analysis to perform'),
    }),
  },
);

/**
 * File processing tool - demonstrates status updates
 */
const processFileTool = tool(
  async ({ filename, operation }, config: ToolRuntime) => {
    // Use a unique ID for this file operation to make it persistent
    const fileOpId = `file-${filename}-${Date.now()}`;

    // Emit file operation status with ID for persistence
    config.writer?.({
      type: 'file-status',
      id: fileOpId,
      filename,
      operation,
      status: 'started',
    } satisfies FileStatusData);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the same part with completed status
    config.writer?.({
      type: 'file-status',
      id: fileOpId,
      filename,
      operation,
      status: 'completed',
      size: `${Math.floor(Math.random() * 1000) + 100}KB`,
    } satisfies FileStatusData);

    return `Successfully ${operation}ed file: ${filename}`;
  },
  {
    name: 'process_file',
    description: 'Process a file with various operations',
    schema: z.object({
      filename: z.string().describe('The filename to process'),
      operation: z
        .enum(['read', 'compress', 'validate', 'transform'])
        .describe('The operation to perform'),
    }),
  },
);

const tools = [analyzeDataTool, processFileTool];
const toolNode = new ToolNode(tools);

/**
 * Call the model with tools bound
 */
async function callModel(state: typeof MessagesAnnotation.State) {
  const modelWithTools = model.bindTools(tools);
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] };
}

/**
 * Determine if we should continue to tools or end
 */
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage &&
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return 'tools';
  }
  return END;
}

/**
 * Create the LangGraph workflow
 */
const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

const graph = workflow.compile();

/**
 * The API route demonstrating custom data parts with LangGraph
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
     * Stream from the LangGraph with custom events enabled
     * The 'custom' stream mode enables receiving custom events from tools
     */
    const stream = await graph.stream(
      { messages: langchainMessages },
      { streamMode: ['values', 'messages', 'custom'] },
    );

    /**
     * Convert the LangGraph stream to UI message stream
     * Custom events with { type: 'progress', ... } become data-progress parts
     * Custom events with { type: 'status', ... } become data-status parts
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
