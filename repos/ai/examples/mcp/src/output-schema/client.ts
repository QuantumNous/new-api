import { createMCPClient } from '@ai-sdk/mcp';
import { z } from 'zod';
import 'dotenv/config';

async function main() {
  console.log('Connecting to MCP server...');

  const mcpClient = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://localhost:8081/sse',
    },
  });

  console.log('Connected! Getting tools with typed outputSchema...\n');

  const tools = await mcpClient.tools({
    schemas: {
      'get-weather': {
        inputSchema: z.object({
          location: z.string(),
        }),
        // outputSchema gives us typed results
        outputSchema: z.object({
          temperature: z.number(),
          conditions: z.string(),
          humidity: z.number(),
          location: z.string(),
        }),
      },
      'list-users': {
        inputSchema: z.object({}),
        outputSchema: z.object({
          users: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              email: z.string(),
            }),
          ),
          metadata: z.object({
            total: z.number(),
            page: z.number(),
            hasMore: z.boolean(),
          }),
        }),
      },
      // Tool without outputSchema
      echo: {
        inputSchema: z.object({
          message: z.string(),
        }),
        // No outputSchema
      },
    },
  });

  console.log('--- Example 1: get-weather (with outputSchema) ---');
  const weatherTool = tools['get-weather'];
  const weatherResult = await weatherTool.execute(
    { location: 'New York' },
    { messages: [], toolCallId: 'weather-1', context: {} },
  );

  const weather = weatherResult as {
    temperature: number;
    conditions: string;
    humidity: number;
    location: string;
  };
  console.log(`Location: ${weather.location}`);
  console.log(`Temperature: ${weather.temperature}°C`);
  console.log(`Conditions: ${weather.conditions}`);
  console.log(`Humidity: ${weather.humidity}%`);
  console.log();

  console.log('--- Example 2: list-users (with nested outputSchema) ---');
  const usersTool = tools['list-users'];
  const usersResult = await usersTool.execute(
    {},
    { messages: [], toolCallId: 'users-1', context: {} },
  );

  const users = usersResult as {
    users: Array<{ id: number; name: string; email: string }>;
    metadata: { total: number; page: number; hasMore: boolean };
  };
  console.log(`Total users: ${users.metadata.total}`);
  console.log('Users:');
  for (const user of users.users) {
    console.log(`  - ${user.name} (${user.email})`);
  }
  console.log();

  console.log('--- Example 3: echo (without outputSchema) ---');
  const echoTool = tools['echo'];
  const echoResult = await echoTool.execute(
    { message: 'Hello, MCP!' },
    { messages: [], toolCallId: 'echo-1', context: {} },
  );

  console.log('Raw result:', JSON.stringify(echoResult, null, 2));
  console.log();

  await mcpClient.close();
  console.log('Done!');
}

main().catch(console.error);
