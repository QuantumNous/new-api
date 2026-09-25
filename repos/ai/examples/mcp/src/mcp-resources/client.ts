import { createMCPClient } from '@ai-sdk/mcp';
import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';

async function main() {
  const mcpClient = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://localhost:8082/sse',
    },
  });

  try {
    const resources = await mcpClient.listResources();
    console.log('RESOURCES:', JSON.stringify(resources, null, 2));

    const templates = await mcpClient.listResourceTemplates();
    console.log('TEMPLATES:', JSON.stringify(templates, null, 2));

    const fixed = await mcpClient.readResource({
      uri: 'file:///example/greeting.txt',
    });
    console.log('READ FIXED:', JSON.stringify(fixed, null, 2));

    const dynamic = await mcpClient.readResource({
      uri: 'file:///example/dynamic.txt',
    });
    console.log('READ DYNAMIC:', JSON.stringify(dynamic, null, 2));

    // TODO: Integrate resource contents into LLM prompt
  } finally {
    await mcpClient.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
