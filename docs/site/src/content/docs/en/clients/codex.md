---
title: Codex CLI
description: Configure DeepPattern API as a Codex CLI provider and use models through the Responses API.
---

Once Codex CLI is installed and you've [created an API key](/en/start/api-key/), follow the steps below. You can also import the configuration in one click with [CC Switch](/en/clients/cc-switch/).

For the combined desktop app, see [ChatGPT (Codex) desktop](/en/clients/chatgpt-codex/). The desktop app stores the API key itself and doesn't rely on environment variables from this terminal session.

## Step 1: Set the key

Replace `sk-your-api-key` with your key:

```bash
export DP_API_KEY="sk-your-api-key"
```

## Step 2: Configure the provider

Edit `~/.codex/config.toml` and merge in the following; update any fields that already exist. Replace `your-model` with an [available model](/en/start/models/) that supports Responses.

```toml
model_provider = "deeppattern"
model = "your-model"

[model_providers.deeppattern]
name = "DeepPattern API"
base_url = "https://{{API_HOST}}/v1"
env_key = "DP_API_KEY"
wire_api = "responses"
```

`env_key` takes the name of the environment variable, not the key itself. Codex supports only `responses`; don't change it to `chat`.

## Step 3: Verify the connection

In the same terminal, from your project directory, run:

```bash
codex exec "Hello"
```

After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).

For models that support only Chat Completions, use [OpenCode](/en/clients/opencode/) or the [OpenAI SDK](/en/clients/sdk/). For all configuration options, see the [official Codex docs](https://developers.openai.com/codex/config-reference/).
