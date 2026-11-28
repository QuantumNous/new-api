import { createMCPClient, ElicitationRequestSchema } from '@ai-sdk/mcp';
import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import 'dotenv/config';

type ElicitationAction = 'accept' | 'decline' | 'cancel';

// Function to interact within the console
async function getInputFromUser(
  message: string,
  schema: unknown,
): Promise<{
  action: ElicitationAction;
  data?: Record<string, unknown>;
}> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log('\n=== Elicitation Request ===');
    console.log(message);

    if (schema) {
      console.log('Schema:', JSON.stringify(schema, null, 2));
    }

    const actionInput = (
      await rl.question('Action (accept/decline/cancel) [accept]: ')
    )
      .trim()
      .toLowerCase();

    const action: ElicitationAction =
      actionInput === 'decline'
        ? 'decline'
        : actionInput === 'cancel'
          ? 'cancel'
          : 'accept';

    if (action !== 'accept') {
      return { action };
    }

    const data: Record<string, unknown> = {};

    if (
      schema &&
      typeof schema === 'object' &&
      !Array.isArray(schema) &&
      (schema as { type?: string }).type === 'object' &&
      'properties' in schema &&
      typeof (schema as { properties?: unknown }).properties === 'object' &&
      (schema as { properties?: unknown }).properties !== null
    ) {
      const objectSchema = schema as {
        properties: Record<string, any>;
        required?: string[];
      };
      const requiredFields = new Set(objectSchema.required ?? []);

      for (const [key, propertySchema] of Object.entries(
        objectSchema.properties,
      )) {
        const title =
          propertySchema && typeof propertySchema === 'object'
            ? (propertySchema.title ?? key)
            : key;

        const label = requiredFields.has(key)
          ? `${title} (required)`
          : `${title} (optional)`;

        const rawValue = (await rl.question(`${label}: `)).trim();

        if (!rawValue && !requiredFields.has(key)) {
          continue;
        }

        const propertyType =
          propertySchema && typeof propertySchema === 'object'
            ? propertySchema.type
            : undefined;

        if (propertyType === 'number' || propertyType === 'integer') {
          const parsed = Number(rawValue);
          if (Number.isNaN(parsed)) {
            console.warn(`Skipping "${key}" — expected a number`);
            continue;
          }
          data[key] = parsed;
        } else if (propertyType === 'boolean') {
          data[key] = ['true', '1', 'yes', 'y'].includes(
            rawValue.toLowerCase(),
          );
        } else {
          data[key] = rawValue;
        }
      }
    } else {
      const rawPayload = await rl.question(
        'Enter JSON payload for response (empty to decline): ',
      );
      if (rawPayload.trim() === '') {
        return { action: 'decline' };
      }
      try {
        Object.assign(data, JSON.parse(rawPayload));
      } catch (error) {
        console.error('Invalid JSON payload. Cancelling request.');
        return { action: 'cancel' };
      }
    }

    return { action, data };
  } finally {
    rl.close();
  }
}

async function main() {
  const mcpClient = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://localhost:8084/sse',
    },
    capabilities: {
      elicitation: {},
    },
  });

  mcpClient.onElicitationRequest(ElicitationRequestSchema, async request => {
    const userResponse = await getInputFromUser(
      request.params.message,
      request.params.requestedSchema,
    );

    return {
      action: userResponse.action,
      content: userResponse.action === 'accept' ? userResponse.data : undefined,
    };
  });

  try {
    const tools = await mcpClient.tools();
    if (!tools['create_event']) {
      console.error('create_event tool is not available on the server.');
      return;
    }

    const { text: response } = await generateText({
      model: openai('gpt-4o-mini'),
      tools,
      stopWhen: isStepCount(12),
      onStepFinish: async ({ toolResults }) => {
        if (toolResults.length > 0) {
          console.log('TOOL RESULTS:', JSON.stringify(toolResults, null, 2));
        }
      },
      prompt:
        'Schedule a new calendar event by gathering any details you need via available tools.',
    });

    console.log('FINAL RESPONSE:', response);
  } finally {
    await mcpClient.close();
  }
}

main().catch(error => {
  console.error('Error running multi-step elicitation client example:', error);
  process.exitCode = 1;
});
