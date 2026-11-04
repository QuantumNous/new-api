---
title: CC Switch (recommended)
description: Import DeepPattern API in one click and configure Claude Code, Codex, or Gemini CLI.
---

CC Switch manages provider settings for Claude Code, Codex, and Gemini CLI in one place, so you don't have to edit config files by hand.

## Step 1: Install and prepare a key

1. Download and install from the [official CC Switch download page](https://github.com/farion1231/cc-switch/releases/latest), then launch it once.
2. Install the clients you plan to use: [Claude Code CLI](https://code.claude.com/docs/en/setup#install-claude-code), [ChatGPT (Codex) desktop](https://chatgpt.com/download/), Codex CLI, or Gemini CLI.
3. Sign in to the console and [create an API key](/en/start/api-key/).

If the download page is unreachable or slow, try the [mirror download](/en/clients/downloads/#cc-switch).

## Step 2: Import the configuration

Open the [API Keys](https://{{API_HOST}}/keys) page and click **`···` → CC Switch** at the right of the key's row.

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/cc-switch-menu.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/cc-switch-menu.webp" alt="CC Switch entry in the key actions menu" width="2052" height="648" loading="lazy" />
  </a>
  <figcaption>Open the CC Switch import menu.</figcaption>
</figure>

Select an **App**, enter a **Name** and **Primary model**, then click **Open CC Switch**. When the browser asks to open an external app, allow it.

Review the settings in the CC Switch confirmation dialog and click **Import**. The URL and key are filled in automatically.

## Step 3: Enable the provider

In the provider list for the app, hover over **DeepPattern API** and click **Enable**.

Once the status shows **In use**, reopen the client.

## Step 4: Verify the connection

Using Claude Code as an example, run in a terminal:

```bash
claude -p "Hello"
```

After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).

## FAQ

- **CC Switch won't open**: Make sure it's installed and has been launched once, and that the browser is allowed to open external apps.
- **Switching has no effect**: Make sure DeepPattern API shows "In use" under the target app, then restart the client.
- **Requests fail**: See [Error codes](/en/api/relay/#general/guide/errors).

For manual setup, see the [Claude Code](/en/clients/claude-code/), [Codex CLI](/en/clients/codex/), or [ChatGPT (Codex) desktop](/en/clients/chatgpt-codex/) guides.
