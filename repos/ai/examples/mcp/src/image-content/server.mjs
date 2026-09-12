#!/usr/bin/env node
import { createInterface } from 'readline';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const rl = createInterface({ input: process.stdin });

rl.on('line', line => {
  const msg = JSON.parse(line);

  if (msg.method === 'initialize') {
    respond(msg.id, {
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'image-test-server', version: '1.0.0' },
      capabilities: { tools: {} },
    });
  }

  if (msg.method === 'notifications/initialized') {
    return;
  }

  if (msg.method === 'tools/list') {
    respond(msg.id, {
      tools: [
        {
          name: 'get-image',
          description: 'Returns a test image',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });
  }

  if (msg.method === 'tools/call') {
    respond(msg.id, {
      content: [
        {
          type: 'image',
          data: TINY_PNG,
          mimeType: 'image/png',
        },
      ],
      isError: false,
    });
  }
});

function respond(id, result) {
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
}
