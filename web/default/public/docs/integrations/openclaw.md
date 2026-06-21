# OpenClaw → DeepRouter

[OpenClaw](https://openclaw.ai) is an AI coding/agent tool driven by a config file. You tell
it about your model providers in a small JSON file (`openclaw.json`) or with a couple of
environment variables, and it can point at any **OpenAI-** or **Anthropic-compatible**
service. DeepRouter is both — so OpenClaw can use it either way.

This one involves editing one small file (or setting two env vars). It's still copy-and-paste —
no programming.

> **TL;DR (OpenAI-compatible, simplest)** — add a provider to `openclaw.json`:
>
> | Setting | Value |
> |---|---|
> | `baseUrl` | `https://api.deeprouter.co/v1` |
> | `apiKey` | your DeepRouter key (`sk-...`) |
> | model | from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to see your usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. **OpenClaw** installed.

> **Honest note:** OpenClaw is config-driven and evolves quickly. The shapes below match
> recent versions, where every model is referenced as `provider/model-id`. If your version's
> keys differ slightly, the idea is the same: a provider with a **base URL** + **API key**,
> then a model named `deeprouter/<model>`. Check OpenClaw's own docs if a key name doesn't match.

---

## Option A — config file (recommended)

1. Open your **`openclaw.json`** config file in any text editor.
2. Add a DeepRouter provider and point a default model at it:

   ```json5
   {
     "models": {
       "providers": {
         "deeprouter": {
           "baseUrl": "https://api.deeprouter.co/v1",
           "apiKey": "sk-your-deeprouter-key"
         }
       },
       "agents": {
         "defaults": {
           "model": "deeprouter/claude-haiku-4-5"
         }
       }
     }
   }
   ```

3. Replace `sk-your-deeprouter-key` with your real key and `claude-haiku-4-5` with any model
   ID from the DeepRouter console **Model Catalog**.
4. Save the file.

That's the **OpenAI-compatible** path — note the `/v1` on the base URL.

### Prefer Claude's native (Anthropic) format?

If you'd rather OpenClaw talk to DeepRouter in Anthropic's native Messages format, set the
provider's protocol/`api` type to `anthropic` and use the **bare host** (no `/v1` — DeepRouter
appends `/v1/messages` itself):

```json5
"deeprouter": {
  "api": "anthropic",
  "baseUrl": "https://api.deeprouter.co",
  "apiKey": "sk-your-deeprouter-key"
}
```

For this path, point your model at a **Claude** model from the catalog (e.g.
`deeprouter/claude-haiku-4-5`).

---

## Option B — environment variables (no file editing)

OpenClaw reads standard env-var overrides. Set the pair that matches the protocol you want,
then restart OpenClaw:

**OpenAI-compatible:**
```bash
export OPENAI_BASE_URL="https://api.deeprouter.co/v1"
export OPENAI_API_KEY="sk-your-deeprouter-key"
```

**Anthropic-native:**
```bash
export ANTHROPIC_BASE_URL="https://api.deeprouter.co"
export ANTHROPIC_AUTH_TOKEN="sk-your-deeprouter-key"
```

(On Windows, use `setx NAME "value"` and reopen your terminal.)

---

## Verify it's working

1. Run a quick OpenClaw command, e.g. list models or send a one-line prompt like
   "Say hello from DeepRouter."
2. You should get a normal reply.
3. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection error / 404 (OpenAI path)** | Base URL must be `https://api.deeprouter.co/v1` (with `/v1`). |
| **Connection error / 404 (Anthropic path)** | Base URL must be `https://api.deeprouter.co` (no `/v1`, no trailing slash). |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Model not found** | Use an exact model ID from the **Model Catalog**, referenced as `deeprouter/<model-id>`. For the Anthropic path, use a Claude model. |
| **JSON won't load** | Check for a stray comma or missing quote in `openclaw.json`. Standard JSON is safest. |

---

## Reference

| Item | OpenAI-compatible | Anthropic-native |
|---|---|---|
| Base URL | `https://api.deeprouter.co/v1` | `https://api.deeprouter.co` |
| Endpoint used | `POST /chat/completions` | `POST /v1/messages` (auto-appended) |
| Auth | `Authorization: Bearer <key>` | `x-api-key` / Bearer token |
| Env vars | `OPENAI_BASE_URL` + `OPENAI_API_KEY` | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` |
| Model reference | `deeprouter/<model-id>` | `deeprouter/<claude-model-id>` |
| Model IDs | DeepRouter console → **Model Catalog** | same |
| Get a key | DeepRouter console → **API Keys** | same |
