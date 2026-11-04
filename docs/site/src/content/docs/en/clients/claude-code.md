---
title: Claude Code
description: Set the API URL, key, and model to connect Claude Code.
---

Install Claude Code with the [official setup guide](https://code.claude.com/docs/en/setup#install-claude-code), then [create an API key](/en/start/api-key/). To configure it through a GUI, use [CC Switch](/en/clients/cc-switch/).

If the download is unreachable or slow, try the [mirror install](/en/clients/downloads/#claude-code-cli).

## Step 1: Set environment variables

Replace `sk-your-api-key` with your key, and `your-model` with an [available model](/en/start/models/) that supports the Anthropic protocol:

```bash
export ANTHROPIC_BASE_URL="https://{{API_HOST}}"
export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
export ANTHROPIC_MODEL="your-model"
```

Don't append `/v1` to the base URL. Claude Code adds the request path itself.

## Step 2: Verify the connection

In the same terminal, run:

```bash
claude -p "Hello"
```

After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).

Environment variables apply only to the current terminal and its child processes. To save or switch configurations, use [CC Switch](/en/clients/cc-switch/). If a request fails, see [Error codes](/en/api/relay/#general/guide/errors).
