import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'example-auth-server',
  version: '1.0.0',
});

// Protected tool: requires auth
mcpServer.tool(
  'get-secret-data',
  'Retrieve protected secret data (requires authentication)',
  {
    secretKey: z.string(),
  },
  async ({ secretKey }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Secret data for key "${secretKey}": This is highly confidential information!`,
        },
      ],
    };
  },
);

// Another protected tool
mcpServer.tool(
  'list-user-resources',
  'List all resources for the authenticated user',
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: 'User Resources: [Resource A, Resource B, Resource C]',
        },
      ],
    };
  },
);

// Simple in-memory token store (for demo purposes)
const validTokens = new Set<string>(['demo-access-token-123']);
const clientRegistry = new Map<
  string,
  { client_id: string; client_secret: string; redirect_uris: string[] }
>();

let transport: SSEServerTransport;

const app = express();

// Middleware to check Authorization header
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const authHeader = req.headers.authorization;
  console.log(
    `[${req.method} ${req.path}] Authorization header:`,
    authHeader ? `Bearer ${authHeader.substring(7, 27)}...` : 'missing',
  );

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('  → 401: No authorization header, sending WWW-Authenticate');
    res.status(401).set({
      'WWW-Authenticate':
        'Bearer resource_metadata="http://localhost:8081/.well-known/oauth-protected-resource"',
    });
    res.send('Unauthorized');
    return;
  }

  const token = authHeader.substring(7);
  if (!validTokens.has(token)) {
    console.log('  → 401: Invalid token');
    res.status(401).set({
      'WWW-Authenticate':
        'Bearer error="invalid_token", resource_metadata="http://localhost:8081/.well-known/oauth-protected-resource"',
    });
    res.send('Invalid token');
    return;
  }

  console.log('  → ✓ Token valid, allowing access');
  next();
}

// OAuth 2.0 Protected Resource Metadata (RFC 9728)
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'http://localhost:8081',
    authorization_servers: ['http://localhost:8081'],
  });
});

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: 'http://localhost:8081',
    authorization_endpoint: 'http://localhost:8081/authorize',
    token_endpoint: 'http://localhost:8081/token',
    registration_endpoint: 'http://localhost:8081/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Dynamic Client Registration (RFC 7591)
app.post('/register', express.json(), (req, res) => {
  const clientId = `client-${Date.now()}`;
  const clientSecret = `secret-${Math.random().toString(36).substring(7)}`;

  clientRegistry.set(clientId, {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: req.body.redirect_uris || [],
  });

  res.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: req.body.redirect_uris || [],
  });
});

// Authorization endpoint (simplified for demo)
app.get('/authorize', (req, res) => {
  // In a real implementation, this would show a login page
  // For demo purposes, we auto-approve and redirect
  const { redirect_uri, state, code_challenge } = req.query;

  // Generate a simple authorization code
  const authCode = `auth-code-${Date.now()}`;

  // Store code_challenge for PKCE verification (in production, use a database)
  (global as any).pendingAuthorizations =
    (global as any).pendingAuthorizations || new Map();
  (global as any).pendingAuthorizations.set(authCode, {
    code_challenge,
    client_id: req.query.client_id,
  });

  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state as string);

  res.redirect(redirectUrl.toString());
});

// Token endpoint
app.post('/token', express.urlencoded({ extended: true }), (req, res) => {
  const { grant_type, code, code_verifier, refresh_token, client_id } =
    req.body;

  if (grant_type === 'authorization_code') {
    // Verify PKCE
    const pending = (global as any).pendingAuthorizations?.get(code);
    if (!pending) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    // In production, verify code_challenge matches code_verifier using SHA256
    // For demo, we skip full PKCE verification

    // Issue token
    const accessToken = 'demo-access-token-123';
    validTokens.add(accessToken);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: `refresh-${Date.now()}`,
    });
  } else if (grant_type === 'refresh_token') {
    // Issue new token from refresh token
    const accessToken = 'demo-access-token-123';
    validTokens.add(accessToken);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  } else {
    res.status(400).json({ error: 'unsupported_grant_type' });
  }
});

// Protected MCP SSE endpoint
app.get('/sse', requireAuth, async (req, res) => {
  console.log('✓ SSE connection authenticated, starting MCP transport...');
  transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);
  console.log('✓ MCP server connected to transport');
});

// Protected MCP messages endpoint
app.post('/messages', requireAuth, async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(8081, () => {
  console.log('Example OAuth-protected SSE MCP server listening on port 8081');
  console.log('Authorization endpoint: http://localhost:8081/authorize');
  console.log('Token endpoint: http://localhost:8081/token');
});
