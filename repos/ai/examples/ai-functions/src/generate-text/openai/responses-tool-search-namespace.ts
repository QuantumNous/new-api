import { openai } from '@ai-sdk/openai';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const crmNamespace = {
  name: 'crm',
  description: 'CRM tools for customer lookup and order management.',
};

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.6'),
    prompt:
      'Look up customer cust_123 and list any open orders for that customer.',
    stopWhen: isStepCount(10),
    onStepFinish: step => {
      console.log(`\n=== Step Content ===`);
      console.dir(step.content, { depth: Infinity });
      console.log(`\n=== Step Response ===`);
      console.dir(step.response.body, { depth: Infinity });
    },
    tools: {
      toolSearch: openai.tools.toolSearch(),

      get_customer_profile: tool({
        description: 'Fetch a customer profile by customer ID.',
        inputSchema: z.object({
          customer_id: z.string().describe('The customer ID to look up.'),
        }),
        execute: async ({ customer_id }) => ({
          customer_id,
          name: 'Jane Doe',
          tier: 'enterprise',
        }),
        providerOptions: {
          openai: {
            namespace: crmNamespace,
          },
        },
      }),

      list_open_orders: tool({
        description: 'List open orders for a customer ID.',
        inputSchema: z.object({
          customer_id: z.string().describe('The customer ID to look up.'),
        }),
        execute: async ({ customer_id }) => ({
          customer_id,
          orders: [
            {
              order_id: 'order_456',
              status: 'processing',
              total: '$129.99',
            },
          ],
        }),
        providerOptions: {
          openai: {
            namespace: crmNamespace,
            deferLoading: true,
          },
        },
      }),
    },
  });

  console.log('\n=== Final Result ===');
  console.log('Text:', result.text);
});
