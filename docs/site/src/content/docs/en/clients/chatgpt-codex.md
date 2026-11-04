---
title: ChatGPT (Codex) desktop
description: Import the DeepPattern API URL, model, and key in one go with CC Switch or a terminal command.
---

Download the desktop app from the [official ChatGPT download page](https://chatgpt.com/download/), then [create an API key in the `ChatGPT` group](/en/start/api-key/).

If the download page is unreachable or slow, try the [mirror download](/en/clients/downloads/#chatgpt-codex-desktop).

**Creating a key doesn't complete the setup.** You also need to import the DeepPattern API base URL, model, and key together. Use either method below, and fully quit ChatGPT before importing.

## Option 1: Import with CC Switch (recommended)

1. Download, install, and open CC Switch from the [official CC Switch download page](https://github.com/farion1231/cc-switch/releases/latest). If it's hard to reach, use the [mirror](/en/clients/downloads/#cc-switch).
2. Open [API Keys](https://{{API_HOST}}/keys) in the console and click **`···` → CC Switch** at the right of the key.

<figure class="tutorial-figure">
  <a href="/images/tutorials/clients/cc-switch-menu.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/clients/cc-switch-menu.webp" alt="Select CC Switch import in the key actions menu" width="2052" height="648" loading="lazy" />
  </a>
  <figcaption>Start the import from this key's menu.</figcaption>
</figure>

3. **Set App to `Codex`**, enter `DeepPattern API` as the name, choose `gpt-5.6-luna` as the primary model, and click **Open CC Switch**.
4. In CC Switch, click **Import**, then enable **DeepPattern API** in the **Codex** list. If it already shows **In use**, no further click is needed.

5. Reopen ChatGPT, switch to **Codex** mode, and start a new conversation.

The import carries `https://{{API_HOST}}/v1`, the model, and this key, so you don't need to paste the key on the ChatGPT sign-in page.

## Option 2: Import with a terminal command (macOS)

Open Terminal, paste and run the entire command below, then paste your key when prompted. The key isn't echoed as you type.

:::caution
The command backs up `config.toml` before replacing it, and doesn't touch your ChatGPT sign-in files. If you need to keep existing MCP servers or other custom settings, use the CC Switch method above. The desktop app and Codex CLI may share this config.
:::

```bash
bash <<'SH'
set -e
umask 077
read -r -s -p 'Paste your DeepPattern API API Key, then press Enter: ' KEY </dev/tty
printf '\n'
[[ "$KEY" =~ ^sk-[A-Za-z0-9_-]+$ ]] || { echo 'Invalid key format. Config not changed.'; exit 1; }
DIR="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$DIR"
BACKUP="$(mktemp -d "$DIR/backup-deeppattern.XXXXXX")"
if [ -f "$DIR/config.toml" ]; then cp -p "$DIR/config.toml" "$BACKUP/config.toml"; fi
TMP="$(mktemp "$DIR/config.deeppattern.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<'TOML'
model_provider = "deeppattern"
model = "gpt-5.6-luna"

[model_providers.deeppattern]
name = "DeepPattern API"
base_url = "https://{{API_HOST}}/v1"
wire_api = "responses"
requires_openai_auth = false
TOML
printf 'experimental_bearer_token = "%s"\n' "$KEY" >> "$TMP"
mv "$TMP" "$DIR/config.toml"
unset KEY
printf 'Config imported. Previous config backed up to: %s\nReopen ChatGPT and switch to Codex mode.\n' "$BACKUP"
SH
```

This command writes the **base URL, model, and key** together; it doesn't just set temporary environment variables. When you see "Config imported", reopen ChatGPT and start a new conversation. No separate API key sign-in is needed. On Windows, use the CC Switch method above.

The config file contains your key, so don't share or upload it. On a shared macOS machine, after importing with CC Switch you can run `chmod 700 ~/.codex && chmod 600 ~/.codex/config.toml` to keep other local accounts from reading it. Files created by the terminal command are already readable and writable only by you.

## Send a message

Start a new conversation in **Codex** mode and enter:

```text
Reply with only Hello. Do not read files or run commands.
```

After you get a reply, check the model, tokens, and cost for the call in [Usage Logs](https://{{API_HOST}}/usage-logs/common). It's charged to your **DeepPattern API balance**, not your ChatGPT subscription.

- **Still shows the sign-in page or the previous provider**: Fully quit and reopen the app. With CC Switch, enable the provider first. Don't re-paste the key in place of importing the config.
- **`401` / `Invalid token`**: Re-import with the correct, complete key.
- **Insufficient balance**: Top up in [Wallet](https://{{API_HOST}}/wallet).

For the command-line client, see [Codex CLI](/en/clients/codex/).
