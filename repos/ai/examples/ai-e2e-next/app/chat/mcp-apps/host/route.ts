import { readMCPAppResource, splitMCPAppTools } from '@ai-sdk/mcp';
import { isJSONObject, type JSONObject } from '@ai-sdk/provider';
import { safeParseJSON } from '@ai-sdk/provider-utils';
import { createLocalMCPAppsClient } from '../mcp-client';

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);
  const bodyResult = await safeParseJSON({ text: await req.text() });

  if (!bodyResult.success) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const body = isJSONObject(bodyResult.value) ? bodyResult.value : undefined;
  const method = body?.method;
  const params = isJSONObject(body?.params) ? body.params : undefined;

  if (typeof method !== 'string') {
    return Response.json({ error: 'Missing method' }, { status: 400 });
  }

  console.log('[mcp-apps/host] request', { method, params });

  const client = await createLocalMCPAppsClient(requestUrl.origin);

  try {
    switch (method) {
      case 'mcp-apps/read-resource': {
        if (typeof params?.uri !== 'string') {
          return Response.json({ error: 'Missing uri' }, { status: 400 });
        }

        console.log('[mcp-apps/host] read MCP app resource', {
          uri: params.uri,
        });

        return Response.json(
          await readMCPAppResource({ client, uri: params.uri }),
        );
      }

      case 'resources/read': {
        if (typeof params?.uri !== 'string') {
          return Response.json({ error: 'Missing uri' }, { status: 400 });
        }

        console.log('[mcp-apps/host] read resource', { uri: params.uri });

        return Response.json(await client.readResource({ uri: params.uri }));
      }

      case 'tools/call': {
        if (typeof params?.name !== 'string') {
          return Response.json({ error: 'Missing tool name' }, { status: 400 });
        }

        const { appVisible } = splitMCPAppTools(await client.listTools());
        const isAllowed = appVisible.tools.some(
          tool => tool.name === params.name,
        );

        if (!isAllowed) {
          return Response.json(
            { error: 'Tool is not app-visible' },
            { status: 403 },
          );
        }

        const toolArguments: JSONObject = isJSONObject(params.arguments)
          ? params.arguments
          : {};

        const result = await client.callTool({
          name: params.name,
          arguments: toolArguments,
        });

        console.log('[mcp-apps/host] app tool call', {
          name: params.name,
          arguments: params.arguments,
          result,
        });

        return Response.json(result);
      }

      default:
        return Response.json({ error: 'Unsupported method' }, { status: 400 });
    }
  } finally {
    await client.close();
  }
}
