---
title: WorkBuddy
description: Add a custom OpenAI-compatible model in WorkBuddy and connect it with your DeepPattern API key and model.
---

WorkBuddy is Tencent's AI agent tool for office work. Following the [official model configuration docs](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A8%A1%E5%9E%8B), you can add a **Custom** model in settings without editing config files.

This guide connects DeepPattern API through **OpenAI Chat Completions**. It doesn't use Tencent Cloud Token Plan or Coding Plan.

## Step 1: Install and prepare a key

1. Download and install the client from the [WorkBuddy website](https://www.workbuddy.ai/).
2. Make sure your [Wallet](https://{{API_HOST}}/wallet) has available balance, then create a key by following [Create an API key](/en/start/api-key/). This example uses the **`Claude` group**; you can name the key `WorkBuddy` to make usage easy to track.
3. In the [API Keys](https://{{API_HOST}}/keys) list, choose **`···` → Copy key**. Don't copy the masked text with asterisks.
4. Open the [Model Square](https://{{API_HOST}}/pricing), search for **`claude-opus-5`**, and under **API → openai** in the model details, confirm the endpoint is `/v1/chat/completions`.

Models and groups follow the console's current configuration. If the example model isn't available, use a text model in your key's group that supports the `openai` endpoint, and enter its full model ID below. Don't use image models or models that only support other protocols.

## Step 2: Open custom model settings

1. Go to WorkBuddy **Settings → Models**.
2. In the **Custom models** section, click **Add model**.
3. Open the **Provider** dropdown and select **Custom**. **Do not select Tencent Cloud Coding Plan**.

## Step 3: Enter the DeepPattern API configuration

Confirm **Provider** is **Custom**, fill in the fields below, and save:

| Setting | Value |
|---|---|
| Provider | **Custom** |
| Endpoint URL | `https://{{API_HOST}}/v1/chat/completions` |
| API KEY | Your full DeepPattern API key, without a `Bearer ` prefix |
| Model name | `claude-opus-5`, or the full model ID you confirmed in the Model Square |
| Custom protocol | **Off**, to use the standard Chat Completions path |

**Enter the full endpoint URL here, not a domain-only base URL.** Don't change it to `/v1/responses` or `/v1/messages`. `Claude` is the console key's group, not a model name.

### Choosing advanced settings

Set the custom provider's capabilities to match what the model actually supports. Don't enable all of them:

| Setting | Recommendation |
|---|---|
| Tool calling | Enable when WorkBuddy needs to call tools or run tasks, after confirming the model supports tool calling |
| Image input | Enable when you need to send images and the model supports image understanding |
| Reasoning mode | Enable only if the model supports the corresponding reasoning request parameters |
| Input / Output | For the first setup, keep "Use provider defaults". If you set them manually, match the model's actual context and output limits |

:::note[Custom protocol doesn't switch the API protocol]
Per the official docs, when it's off, WorkBuddy validates and completes the standard `/chat/completions` path; when it's on, WorkBuddy uses the URL exactly as entered and skips path validation and completion. DeepPattern API uses standard endpoints, so leave it off. Turning it on doesn't make WorkBuddy use Anthropic Messages or OpenAI Responses.
:::

When you're done, click **Save**. The configuration is persisted automatically, and you can edit or delete it later from the model list.

### Add models in bulk with a config file (optional)

Custom models saved in the UI are written to `~/.workbuddy/models.json`. You can also edit this file directly, which is handy for configuring several models at once or copying settings between machines.

To skip writing it by hand, click **`···` → WorkBuddy** on a key's row in the console's [API Keys](https://{{API_HOST}}/keys) list, choose the model and capabilities, then **Copy config** or **Download models.json**. The endpoint URL, key, and model ID are already filled in; just paste them into the file below.

In WorkBuddy **Settings → Models**, click the `~/.workbuddy/models.json` link in the "Custom models" description to open the file, then paste in the generated configuration and save.

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/workbuddy-models-json-entry.png" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/workbuddy-models-json-entry.png" alt="WorkBuddy Settings → Models page; click the ~/.workbuddy/models.json link in the Custom models description to open the config file" width="1568" height="1185" loading="lazy" />
  </a>
  <figcaption>Click ~/.workbuddy/models.json in the red box to open the config file; WorkBuddy reloads automatically after you paste and save. Click the image to enlarge.</figcaption>
</figure>

```json title="~/.workbuddy/models.json"
[
  {
    "id": "claude-opus-5",
    "name": "DeepPattern API · claude-opus-5",
    "vendor": "Custom",
    "url": "https://{{API_HOST}}/v1/chat/completions",
    "apiKey": "${DP_API_KEY}",
    "supportsToolCall": true,
    "supportsImages": true,
    "useCustomProtocol": false
  }
]
```

- **The top level of the file is an array**, so the whole content must be wrapped in `[ ]`. If the file already contains models, append the new object to the existing array (separate objects with `,`). Don't overwrite the whole array or paste a bare object; either breaks JSON parsing and the config won't take effect.
- The `{"models": [...], "availableModels": [...]}` object form is also supported; the UI saves a top-level array.
- `id` is required and must be the full model ID. `url` must be the full endpoint URL, still ending in `/chat/completions`.
- `apiKey` and `url` support `${ENV_VAR_NAME}` references, so you don't have to store the key in plain text. If you do use plain text, set the file permissions to `600`.
- After you save, WorkBuddy detects the file change and reloads automatically (about a 1-second debounce). No restart is needed.
- Project-level config goes in `<project-dir>/.codebuddy/models.json`; entries with the same `id` override the user-level config.

## Step 4: Select the model in a chat

1. Go back to the WorkBuddy chat view and start a new session.
2. Open the model picker and select the model you just added under **Custom models**.
3. For the first check, don't stay on **Auto mode** or a built-in model. In auto mode WorkBuddy picks the model, so you can't confirm the request went through DeepPattern API.
4. Start with a simple request that doesn't access local files or call tools:

```text
Reply with only: Hello. Do not read or modify local files, and do not call tools.
```

On success, the model's reply appears in the chat. In a standard non-streaming Chat Completions response, the content is in `choices[0].message.content`; when streaming, it's in `choices[0].delta.content`. To check the key, model, and endpoint independently, use the cURL example in the [Quickstart](/en/start/quickstart/).

**Saving the config doesn't mean the call succeeded.** Model requests are billed by actual usage, and complex agent tasks may make multiple calls. Try tool-based tasks only after the first check passes.

## Step 5: Check the request log

Open [Usage Logs](https://{{API_HOST}}/usage-logs/common):

1. Select a time range that includes the request, and set the type to **Consumption**.
2. Enter the model you used in **Model name**. Expand the filters and enter the key name, such as `WorkBuddy`, in **Token name**.
3. Click **Search** and check the model, tokens, cost, and latency to confirm the request used this DeepPattern API key.

If the client replies but there's no matching record, check the time range and key name, and make sure the session actually selected the **Custom model** rather than auto mode or a built-in model.

## FAQ

| Symptom | What to check |
|---|---|
| `401` / invalid key | Copy the full key again and confirm it isn't disabled or expired. Don't enter masked text or a `Bearer ` prefix |
| `403` / forbidden | Check that the key's group, model restrictions, and IP restrictions allow the call |
| `404` / wrong path | Use the full endpoint URL from the table above and check for a duplicated `/v1` or `/chat/completions`. Keep custom protocol off for standard endpoints |
| Model not found or unavailable | Use the full model ID from the Model Square and confirm it matches your key's group and the `openai` endpoint |
| Insufficient balance or quota | Check your account balance and this key's remaining quota |
| Chat works but tools don't | Confirm the model supports tool calling and enable that capability in advanced settings. Enabling a capability doesn't add support the model lacks |
| Built-in model still used after saving | Reselect the custom model in the current session's model picker |

For more request errors, see [API error codes](/en/api/relay/#general/guide/errors).

## Official references

- [WorkBuddy: Model configuration and custom models](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A8%A1%E5%9E%8B)
- [WorkBuddy: URL handling for custom protocol](https://www.workbuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model#%E8%87%AA%E5%AE%9A%E4%B9%89%E5%8D%8F%E8%AE%AE)

The illustrations in this guide are based on the [model settings screenshot](https://www.workbuddy.ai/docs/static/model-1.BuUbNA6x.png) and [custom model screenshot](https://www.workbuddy.ai/docs/static/model-7.Buzcl1Ob.png) from the official docs above, cropped, annotated with numbers, and filled with example values to show how to configure DeepPattern API. They are not screenshots of a real configured account and contain no real keys.
