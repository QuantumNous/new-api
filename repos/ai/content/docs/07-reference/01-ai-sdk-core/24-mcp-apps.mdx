---
title: MCP Apps
description: API reference for MCP Apps helpers in @ai-sdk/mcp.
---

# MCP Apps

The MCP Apps helpers in `@ai-sdk/mcp` help an MCP host advertise UI support, keep model-visible and app-visible tools separate, and read `ui://` HTML resources for rendering.

## Import

<Snippet
  text={`import {
  MCP_APP_MIME_TYPE,
  mcpAppClientCapabilities,
  readMCPAppResource,
  splitMCPAppTools,
} from "@ai-sdk/mcp"`}
  prompt={false}
/>

## `MCP_APP_MIME_TYPE`

The MIME type for HTML resources that should be rendered as MCP Apps.

```ts
const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
```

## `mcpAppClientCapabilities`

Client capabilities to pass to [`createMCPClient`](/docs/reference/ai-sdk-core/create-mcp-client) when your host supports MCP Apps.

```ts
import { createMCPClient, mcpAppClientCapabilities } from '@ai-sdk/mcp';

const client = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://example.com/mcp',
  },
  capabilities: mcpAppClientCapabilities,
});
```

The advertised capability is:

```json
{
  "extensions": {
    "io.modelcontextprotocol/ui": {
      "mimeTypes": ["text/html;profile=mcp-app"]
    }
  }
}
```

## `splitMCPAppTools()`

Splits MCP tool definitions into model-visible tools and app-visible tools.

Tools without MCP Apps visibility metadata remain model-visible. Tools whose `_meta.ui.visibility` includes `"app"` are returned in `appVisible`.

```ts
const definitions = await client.listTools();
const { modelVisible, appVisible } = splitMCPAppTools(definitions);

const tools = client.toolsFromDefinitions(modelVisible);
```

### Parameters

<PropertiesTable
  content={[
    {
      name: 'definitions',
      type: 'ListToolsResult',
      description: 'The tool definitions returned by `client.listTools()`.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'modelVisible',
      type: 'ListToolsResult',
      description:
        'Tool definitions that can be exposed to the language model.',
    },
    {
      name: 'appVisible',
      type: 'ListToolsResult',
      description:
        'Tool definitions that can be called by an MCP App through the host bridge.',
    },
  ]}
/>

## `readMCPAppResource()`

Reads a `ui://` resource from an MCP server and normalizes it into HTML plus rendering metadata.

```ts
const resource = await readMCPAppResource({
  client,
  uri: 'ui://example/dashboard',
});
```

The helper validates that the URI starts with `ui://`, requires the `text/html;profile=mcp-app` MIME type, and supports resource contents returned as either text or base64 blob data.

### Parameters

<PropertiesTable
  content={[
    {
      name: 'client',
      type: "Pick<MCPClient, 'readResource'>",
      description: 'The MCP client used to read the resource.',
    },
    {
      name: 'uri',
      type: 'string',
      description: 'The `ui://` resource URI to read.',
    },
    {
      name: 'options',
      type: 'RequestOptions',
      isOptional: true,
      description:
        'Optional request options, such as an abort signal or timeout.',
    },
  ]}
/>

### Returns

Returns a `Promise<MCPAppResource>`.

<PropertiesTable
  content={[
    {
      name: 'uri',
      type: 'string',
      description: 'The `ui://` resource URI.',
    },
    {
      name: 'mimeType',
      type: "'text/html;profile=mcp-app'",
      description: 'The MCP Apps HTML MIME type.',
    },
    {
      name: 'html',
      type: 'string',
      description: 'The app HTML to render in a sandboxed iframe.',
    },
    {
      name: 'meta',
      type: 'MCPAppResourceMeta',
      isOptional: true,
      description:
        'Rendering metadata from resource `_meta.ui`, such as CSP, permissions, and `prefersBorder`.',
    },
  ]}
/>

## See Also

<ExampleLinks
  examples={[
    {
      title: 'MCP Apps guide',
      link: '/docs/ai-sdk-core/mcp-apps',
    },
    {
      title: 'createMCPClient',
      link: '/docs/reference/ai-sdk-core/create-mcp-client',
    },
  ]}
/>
