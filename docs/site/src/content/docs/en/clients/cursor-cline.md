---
title: Cursor and Cline
description: Configure Cursor and Cline with the OpenAI-compatible API.
---

First [create an API key](/en/start/api-key/) and confirm the [available model IDs](/en/start/models/).

## Cursor

1. Open **Settings → Models** and enter your **OpenAI API Key**.
2. Enable **Override OpenAI Base URL** and enter `https://{{API_HOST}}/v1`.
3. Add the model ID, verify the connection, then select that model in a chat.

A custom API key doesn't work with every Cursor feature.

## Cline

Open Cline settings, fill in the following, and save:

| Setting | Value |
|---|---|
| API Provider | `OpenAI Compatible` |
| Base URL | `https://{{API_HOST}}/v1` |
| API Key | Your API key |
| Model ID | A model ID your key can call |

## Verify the connection

Start a new chat and send `Hello`. After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).

For tool use, choose a model that supports function calling. If a request fails, see [Error codes](/en/api/relay/#general/guide/errors).
