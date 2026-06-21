# OpenAI Codex CLI → DeepRouter

Point OpenAI's [Codex CLI](https://developers.openai.com/codex) at DeepRouter so its
requests run through your DeepRouter account instead of going straight to OpenAI.
Codex speaks the **OpenAI protocol**, and DeepRouter ships an OpenAI‑compatible endpoint,
so this is a config‑file change — no coding required.

> **TL;DR** — add a provider to `~/.codex/config.toml` and set one API key.
> ```toml
> # ~/.codex/config.toml
> model = "claude-haiku-4-5"
> model_provider = "deeprouter"
>
> [model_providers.deeprouter]
> name = "DeepRouter"
> base_url = "https://api.deeprouter.co/v1"
> env_key = "DEEPROUTER_API_KEY"
> wire_api = "chat"
> ```
> ```bash
> export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
> ```

---

## Why route Codex through DeepRouter

- **One key, every model.** GPT‑family, Claude, and many open models — all reachable through
  the same OpenAI‑shaped endpoint, with automatic model routing and fallback.
- **Smart routing.** DeepRouter picks the right model and channel per request and fails over
  automatically when an upstream is down.
- **Billing in one place.** Your team's usage, spend, and logs all live in the DeepRouter console.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (it starts with `sk-`). Get it from the console:
   **API Keys** page (it's also shown once on your welcome screen right after signup).
3. Codex CLI installed:
   ```bash
   npm install -g @openai/codex
   ```

---

## Step 1 — Open (or create) the Codex config file

The file lives at:

```
~/.codex/config.toml
```

On a Mac that's `/Users/you/.codex/config.toml`. If the `.codex` folder or the file
isn't there yet, create them. (The leading dot means it's hidden — in Finder press
`Cmd‑Shift‑.` to show hidden files, or just edit it from your terminal.)

> **Important:** Codex only reads provider settings from this **user‑level** file in your
> home folder. A `config.toml` inside a project folder is ignored for providers.

---

## Step 2 — Add DeepRouter as a provider

Paste this into `~/.codex/config.toml`:

```toml
# Which model to use by default (pick any ID from the DeepRouter Model Catalog)
model = "claude-haiku-4-5"
# Use the DeepRouter provider defined below
model_provider = "deeprouter"

[model_providers.deeprouter]
name = "DeepRouter"
# DeepRouter's OpenAI-compatible endpoint (note: ends in /v1, no trailing slash)
base_url = "https://api.deeprouter.co/v1"
# Name of the environment variable that holds your key (set in Step 3)
env_key = "DEEPROUTER_API_KEY"
# DeepRouter speaks Chat Completions
wire_api = "chat"
```

What each line does, in plain terms:

- **`model`** — the model Codex asks for. Copy an exact ID from the console **Model Catalog**.
- **`model_provider`** — tells Codex to use the `deeprouter` block instead of the built‑in OpenAI one.
- **`base_url`** — where requests go. Codex adds `/chat/completions` to this for you.
- **`env_key`** — Codex reads your key from this environment variable, so the secret never sits in the file.
- **`wire_api`** — the API "dialect." DeepRouter's `/v1` endpoint serves **Chat Completions**, so this is `chat`.

> **Heads‑up about `wire_api`.** Newer Codex builds prefer `wire_api = "responses"` (OpenAI's
> Responses API). DeepRouter's `/v1` endpoint is **Chat Completions**, so use `wire_api = "chat"`.
> If your Codex version refuses to start with `"chat"`, you're on a build that dropped the Chat
> dialect — update to a build that still supports it, or check the DeepRouter console for the
> latest recommended setting.

---

## Step 3 — Put your key in the environment

Add your DeepRouter key to your shell profile (`~/.zshrc`, `~/.bashrc`, or your fish config):

```bash
export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
```

Then reload your shell (or just open a new terminal window):

```bash
source ~/.zshrc
```

---

## Verify it's working

Start Codex in any project folder:

```bash
cd your-project
codex
```

Ask it something simple like "say hello." A normal reply means traffic is flowing through DeepRouter.

You can also confirm the endpoint directly with curl — a `200` response means you're routed correctly:

```bash
curl https://api.deeprouter.co/v1/chat/completions \
  -H "Authorization: Bearer $DEEPROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

To double‑check which account is billed, open the DeepRouter console and watch your usage
tick up after a request.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection or 404 errors** | Make sure `base_url` is exactly `https://api.deeprouter.co/v1` — with `/v1`, and **no trailing slash**. |
| **Authentication / 401** | The key is wrong or empty. Check `DEEPROUTER_API_KEY` is set (`echo $DEEPROUTER_API_KEY`) and that `env_key` in the file matches that exact name. |
| **Provider settings ignored** | You edited a project‑local `config.toml`. Provider blocks only work in `~/.codex/config.toml` in your home folder. |
| **Still going to OpenAI** | An old `model_provider` is in effect, or a different config wins. Confirm `model_provider = "deeprouter"` and restart Codex in a fresh terminal. |
| **Won't start with `wire_api = "chat"`** | Your Codex build dropped the Chat dialect. Update to a build that supports it (see the note in Step 2). |
| **`model not found`** | That model isn't enabled for your account. Pick an ID from the console **Model Catalog**. |

---

## Reference

| Item | Value |
|---|---|
| Config file | `~/.codex/config.toml` (user‑level only) |
| OpenAI‑compatible base URL | `https://api.deeprouter.co/v1` |
| Endpoint | `POST /chat/completions` (appended by Codex) |
| `wire_api` | `chat` |
| Auth | `Authorization: Bearer <key>` (Codex sends your `env_key` value) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
