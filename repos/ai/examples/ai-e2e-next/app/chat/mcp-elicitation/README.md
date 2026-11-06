# MCP Elicitation UI Example

This example demonstrates how to use the MCP (Model Context Protocol) elicitation feature in a Next.js application with a chat interface.

## How It Works

1. **User sends a message** requesting an action (e.g., "register me as a new user")
2. **AI model calls the appropriate MCP tool** (e.g., `register_user`)
3. **MCP server requests user input** via an elicitation request with a JSON schema
4. **Frontend displays a modal form** based on the schema
5. **User fills in the form** and submits, declines, or cancels
6. **Response is sent back** to the MCP server
7. **Tool execution completes** and the AI model continues the conversation

## Setup

### 1. Start the MCP Server

```bash
pnpm tsx src/elicitation-ui/server.ts
```

This will start the server on `http://localhost:8085`.

### 2. Run the Next.js Application

```bash
cd examples/ai-e2e-next
pnpm dev
```

### 4. Open the Example

Navigate to `http://localhost:3000/mcp-elicitation`

## Usage

1. Type a message in the chat input, such as:
   - "register me as a new user"
   - "help me sign up for an account"
   - "I'd like to create a new account"

2. The AI will call the `register_user` tool, which triggers an elicitation request.

3. A modal will appear asking you to fill in registration information:
   - Username (required)
   - Email (required)
   - Password (required)
   - Newsletter subscription (optional, defaults to false)

4. You can:
   - **Submit**: Accept and send the filled form data
   - **Decline**: Reject providing the information
   - **Cancel**: Cancel the entire operation

5. The conversation continues based on your response.

This example involves working with human-in-the-loop tools and MCP Elicitation requests.
