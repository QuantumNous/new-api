---
title: Abort and resumable streams
description: Troubleshooting abort and stop behavior with resumable streams
---

# Abort and resumable streams

## Issue

When using `useChat` with `resume: true` for stream resumption, client-side aborts are treated as disconnects. Closing a tab, refreshing the page, navigating away, or calling `stop()` closes the current HTTP connection, but it should not cancel the underlying generation.

If your application passes the request abort signal through to the model call, disconnects can cancel the work that stream resumption expects to keep running. If your stop button only calls `stop()`, the server-side generation can continue and the client may reconnect to the same active stream.

```tsx
const { messages, stop } = useChat({
  id: chatId,
  resume: true, // Stream resumption enabled
});

// stop() only aborts the current client request.
// It is not a server-side cancellation request.
```

## Background

Stream resumption lets the client reconnect to an active stream after the original connection closes. To support that, the server needs to keep the stream producer running even when no client is currently connected.

This means route cleanup, page unloads, and network disconnects should be handled as resumable disconnects. Explicit user cancellation needs a separate server-side signal that cancels the active producer and clears the stored active stream reference.

## Solution

Use `resume: true` for reconnecting after disconnects, and add a dedicated stop endpoint for explicit user cancellation.

The stop endpoint should:

1. Load the chat and read its active stream ID
2. Persist the latest partial assistant message if the client sends one
3. Cancel the work that is producing the stream
4. Clear the active stream reference only if it still points to the same stream

On the client, call your stop endpoint before stopping the local chat stream:

```tsx
const chat = useChat({
  id: chatId,
  resume: true,
});

async function stopStream() {
  await fetch(`/api/chat/${chatId}/stop`, { method: 'POST' });
  chat.stop();
}
```

Keep navigation separate from stop behavior. Do not call the stop endpoint from route cleanup code, page unload handlers, or component unmount cleanup. Those events are disconnects that should remain resumable.

If you do not need stream resumption and only want client-side cancellation, disable `resume` and use `stop()` directly:

```tsx
const { messages, sendMessage, stop } = useChat({
  id: chatId,
  resume: false, // Disable stream resumption (default behavior)
});
```

## Related

- [Chatbot Resume Streams](/docs/ai-sdk-ui/chatbot-resume-streams)
- [Stopping Streams](/docs/advanced/stopping-streams)
