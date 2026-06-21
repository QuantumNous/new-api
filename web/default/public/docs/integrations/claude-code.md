# Claude Code → DeepRouter

Route Anthropic's [Claude Code](https://claude.com/claude-code) CLI through DeepRouter.
DeepRouter speaks the **native Anthropic Messages API**, so Claude Code works with
**zero code changes** — you only point it at our endpoint and give it a DeepRouter key.

> **TL;DR** — set two environment variables:
> ```bash
> export ANTHROPIC_BASE_URL=https://api.deeprouter.co
> export ANTHROPIC_AUTH_TOKEN=sk-...your-deeprouter-key...
> ```

---

## Why route Claude Code through DeepRouter

- **One key, every model.** Claude, plus Qwen / GLM / DeepSeek / Kimi and more — all reachable
  through the same Anthropic-shaped endpoint, with automatic model routing and fallback.
- **Smart routing.** DeepRouter picks the right model/channel per request (Layer-1 model routing
  + Layer-2 channel routing) and fails over automatically when an upstream is down.
- **Billing & audit in one place.** Usage, spend, and logs for your whole team in the DeepRouter console.

---

## Prerequisites

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Grab it from the console:
   **Dashboard → API Keys** (it's also shown once on your welcome screen right after signup).
3. Claude Code installed:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

---

## Option A — Configure with environment variables (fastest)

Add these to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`):

```bash
# DeepRouter endpoint (Claude Code appends /v1/messages automatically — no trailing slash)
export ANTHROPIC_BASE_URL=https://api.deeprouter.co
# Your DeepRouter API key
export ANTHROPIC_AUTH_TOKEN=sk-...your-deeprouter-key...
```

Reload your shell, then start Claude Code:

```bash
source ~/.zshrc   # or open a new terminal
cd your-project
claude
```

On first launch, press **Esc** to skip the Anthropic login — you're authenticating via DeepRouter,
not via an Anthropic subscription.

> **`ANTHROPIC_AUTH_TOKEN` vs `ANTHROPIC_API_KEY`** — use `ANTHROPIC_AUTH_TOKEN`. Claude Code sends it
> as a Bearer token, which is what DeepRouter expects. (`ANTHROPIC_API_KEY` also works but may trigger
> Claude Code's "custom key" confirmation prompt on each launch.)

---

## Option B — Persist in Claude Code settings (no shell edits)

Claude Code reads `~/.claude/settings.json`. Put the same values under `env`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deeprouter.co",
    "ANTHROPIC_AUTH_TOKEN": "sk-...your-deeprouter-key..."
  }
}
```

This applies globally to every project. For a single project, use `.claude/settings.json` in the repo root.

---

## Option C — Use a GUI switcher (CC Switch)

If you juggle multiple providers, [CC Switch](https://github.com/farion1231/cc-switch) gives you a
visual on/off toggle so you don't hand-edit JSON.

| Field | Value |
|---|---|
| Provider Name | `deeprouter` |
| Website URL | `https://deeprouter.co` |
| API Key | your DeepRouter API key (`sk-...`) |
| Request URL | `https://api.deeprouter.co` *(no trailing slash)* |
| API Format / Auth | Anthropic Messages (Native) / `ANTHROPIC_AUTH_TOKEN` |
| Model Configuration | leave empty to use the default Claude model |

Click **Use** to activate, then start Claude Code in your project.

---

## Using non-Claude models

Because DeepRouter routes by model name, you can tell Claude Code to use any Anthropic-protocol
model in our catalog (Qwen, GLM, DeepSeek, …). Map the model slots in Claude Code:

```bash
# Primary + lightweight model overrides
export ANTHROPIC_MODEL=deepseek/deepseek-v3
export ANTHROPIC_SMALL_FAST_MODEL=qwen/qwen3-plus
```

Or leave them unset to let DeepRouter's smart router pick the best model per request.
Browse available model IDs in the console **Model Catalog**.

---

## Verify it's working

Inside Claude Code, run:

```
/status
```

Check:

- **Anthropic base URL** → `https://api.deeprouter.co`
- **Model** → the active model

Or test the endpoint directly with curl:

```bash
curl https://api.deeprouter.co/v1/messages \
  -H "x-api-key: sk-...your-deeprouter-key..." \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

A `200` with a `content` block means you're routed correctly.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Authentication error** | Confirm `ANTHROPIC_BASE_URL` is `https://api.deeprouter.co` and the key is valid / has quota in the console. |
| **Connection timeout** | Check the URL has **no trailing slash** (`…deeprouter.co`, not `…deeprouter.co/`). |
| **Still hitting api.anthropic.com** | An old `ANTHROPIC_BASE_URL` or a logged-in Anthropic session is overriding. Run `/status` to see the effective URL; unset stale env vars and re-launch. |
| **Wrong model used** | Set `ANTHROPIC_MODEL` explicitly, or check your routing rules in the console. |
| **`model not found`** | The model ID isn't enabled for your account — pick one from the console Model Catalog. |

---

## Reference

| Item | Value |
|---|---|
| Anthropic base URL | `https://api.deeprouter.co` |
| Messages endpoint | `POST /v1/messages` (appended by Claude Code) |
| Auth header | `x-api-key: <key>` or `Authorization: Bearer <key>` |
| OpenAI-compatible base | `https://api.deeprouter.co/v1` (`/chat/completions`) |
| Get a key | DeepRouter console → API Keys |
