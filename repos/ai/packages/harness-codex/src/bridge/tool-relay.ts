import { createServer, type Server } from 'node:http';
import {
  ToolRelayAuthorizer,
  ToolRelayPendingCalls,
  type ToolRelayCall,
} from './tool-relay-auth';

export type ToolRelay = {
  port: number;
  close(): void;
  authorizeToolCall(call: ToolRelayCall): void;
};

export async function startAuthorizedToolRelay({
  tools,
  emit,
  requestToolResult,
  authorizer = new ToolRelayAuthorizer(),
}: {
  tools: ReadonlyArray<{ name: string }>;
  emit: (message: Record<string, unknown>) => void;
  requestToolResult: (
    toolCallId: string,
  ) => Promise<{ output: unknown; isError?: boolean }>;
  authorizer?: ToolRelayAuthorizer;
}): Promise<ToolRelay> {
  const toolNames = new Set(tools.map(tool => tool.name));
  const pendingCalls = new ToolRelayPendingCalls();

  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.url !== '/') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized tool relay request' }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const { requestId, toolName, input } = JSON.parse(body) as {
        requestId: string;
        toolName: string;
        input: unknown;
      };

      if (!toolNames.has(toolName)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: `Tool "${toolName}" is not available` }),
        );
        return;
      }
      const relayCall = { toolName, input };
      if (!(await authorizer.waitForToolCallAuthorization(relayCall))) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized tool relay request' }));
        return;
      }

      const { result } = pendingCalls.begin({
        call: relayCall,
        run: async () => {
          emit({
            type: 'tool-call',
            toolCallId: requestId,
            toolName,
            input: JSON.stringify(input ?? {}),
            providerExecuted: false,
          });

          const toolResult = await requestToolResult(requestId);
          emit({
            type: 'tool-result',
            toolCallId: requestId,
            toolName,
            result: toolResult.output ?? null,
            isError: !!toolResult.isError,
          });
          return toolResult;
        },
      });
      const { output } = await result;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: output }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('tool relay did not expose a numeric port');
  }
  return {
    port: address.port,
    close: () => {
      authorizer.close();
      closeServer(server);
    },
    authorizeToolCall: call => authorizer.authorizeToolCall(call),
  };
}

function closeServer(server: Server): void {
  try {
    server.close();
  } catch {}
}
