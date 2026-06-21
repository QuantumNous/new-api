# CC Switch → DeepRouter

[CC Switch](https://github.com/farion1231/cc-switch) is a small free desktop app
(a GUI) that lets you keep several Claude Code "providers" on hand and flip between
them with one click. Instead of hand-editing config files, you fill in a form once,
press a button, and CC Switch writes the right settings into `~/.claude/settings.json`
for you. This guide adds **DeepRouter** as one of those providers.

> **TL;DR** — In CC Switch click **Add**, then fill in:
>
> | Field | Value |
> |---|---|
> | Provider Name (Name) | `deeprouter` |
> | Website (Website Link) | `https://deeprouter.co` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Request URL (Endpoint URL / base_url) | `https://api.deeprouter.co` *(no trailing slash)* |
> | API Format | **Anthropic Messages (Native)** |
> | Auth field | `ANTHROPIC_AUTH_TOKEN` |
> | Model config | leave empty |
>
> Save, then click **Use** (labelled **Enable** in newer versions) on the DeepRouter card.

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to track usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. **CC Switch** installed (download it from the [releases page](https://github.com/farion1231/cc-switch/releases)).
4. **Claude Code** already installed — CC Switch only manages *which* provider Claude Code uses.

---

## Add DeepRouter as a provider

1. Open **CC Switch**.
2. Click **Add** (the button to create a new provider).
3. Fill in the form:
   - **Provider Name**: `deeprouter` — this is just a label so you can recognise it later.
   - **Website**: `https://deeprouter.co` — optional, just a convenience link on the card.
   - **API Key**: paste your DeepRouter key (`sk-...`).
   - **Request URL** (your version may call this **Endpoint URL** or **base_url**):
     `https://api.deeprouter.co`
     *(Use the bare host — **no** `/v1`, **no** trailing slash. DeepRouter adds
     `/v1/messages` itself when it speaks Anthropic's format.)*
   - **API Format**: choose **Anthropic Messages (Native)**. This tells CC Switch that
     DeepRouter should be talked to in Claude's own message format — the same one
     Claude Code uses by default.
   - **Auth field**: select **`ANTHROPIC_AUTH_TOKEN`** (not `ANTHROPIC_API_KEY`).
     This is the environment variable Claude Code will read your key from.
   - **Model config**: **leave it empty.** When this is blank, Claude Code uses its
     normal default models, which DeepRouter routes for you. You only need to set
     models here if you want to pin a specific one.
4. Click **Save** / **Add** to store the provider.

---

## Switch to DeepRouter

In the provider list, find the **deeprouter** card and click **Use**
(in newer CC Switch versions this button is labelled **Enable**).

That single click rewrites your `~/.claude/settings.json` so Claude Code now points at
DeepRouter. You don't have to edit any files by hand — CC Switch did it for you.

> If Claude Code is already running, restart it (close and reopen, or start a new
> session) so it picks up the new settings.

---

## Verify it's working

1. Open a terminal and start Claude Code in any project (`claude`).
2. Ask it something simple, like *"Say hello from DeepRouter."* You should get a normal reply.
3. Open the DeepRouter console — the request should show up in your usage/logs.

You can also peek at the file CC Switch wrote:

```bash
cat ~/.claude/settings.json
```

You should see an `env` block containing `ANTHROPIC_BASE_URL` set to
`https://api.deeprouter.co` and `ANTHROPIC_AUTH_TOKEN` set to your key.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Auth / 401 error** | Re-check the key (`sk-...`) and that it has quota in the console (**API Keys** + billing). Make sure you used the **`ANTHROPIC_AUTH_TOKEN`** auth field, not `ANTHROPIC_API_KEY`. |
| **Connection error / 404** | The Request URL must be exactly `https://api.deeprouter.co` — no `/v1`, no trailing slash. Don't turn on "Full URL Mode". |
| **Claude Code ignores the change** | Restart Claude Code after clicking **Use** / **Enable** so it re-reads `~/.claude/settings.json`. |
| **Model not found** | Leave model config empty, or use an exact model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`). |
| **Wrong format errors** | Make sure **API Format** is **Anthropic Messages (Native)**, not OpenAI Chat Completions. |

---

## Reference

| Item | Value |
|---|---|
| Provider Name | `deeprouter` |
| Request URL (base_url) | `https://api.deeprouter.co` (no `/v1`, no trailing slash) |
| Endpoint used | `POST /v1/messages` (DeepRouter appends this) |
| API Format | Anthropic Messages (Native) |
| Auth field | `ANTHROPIC_AUTH_TOKEN` (→ `Authorization: Bearer <key>`) |
| File written | `~/.claude/settings.json` |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
