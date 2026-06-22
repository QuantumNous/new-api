# Google Gemini CLI → DeepRouter

Point Google's [Gemini CLI](https://github.com/google-gemini/gemini-cli) at DeepRouter so its
requests run through your DeepRouter account instead of going straight to Google.
Gemini CLI talks the **native Gemini API**, and DeepRouter offers a matching Gemini‑compatible
endpoint — so this is just two environment variables, no coding required.

> **TL;DR** — set two environment variables:
> ```bash
> export GOOGLE_GEMINI_BASE_URL=https://api.deeprouter.co/v1beta
> export GEMINI_API_KEY=sk-...your-deeprouter-key...
> ```

---

## Why route Gemini CLI through DeepRouter

- **One key, every model.** Gemini, plus many other models in the catalog — reachable through
  the same endpoint, with automatic model routing and fallback.
- **Smart routing.** DeepRouter picks the right model and channel per request and fails over
  automatically when an upstream is down.
- **Billing in one place.** Your team's usage, spend, and logs all live in the DeepRouter console.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (it starts with `sk-`). Get it from the console:
   **API Keys** page (it's also shown once on your welcome screen right after signup).
3. Gemini CLI installed:
   ```bash
   npm install -g @google/gemini-cli
   ```

---

## Step 1 — Set the two environment variables

Gemini CLI reads two settings to redirect its traffic:

- **`GOOGLE_GEMINI_BASE_URL`** — where requests go. Point it at DeepRouter's Gemini endpoint.
- **`GEMINI_API_KEY`** — your key. Put your DeepRouter key here (not a Google key).

Add both to your shell profile (`~/.zshrc`, `~/.bashrc`, or your fish config):

```bash
# Send Gemini CLI to DeepRouter's Gemini-compatible endpoint (no trailing slash)
export GOOGLE_GEMINI_BASE_URL=https://api.deeprouter.co/v1beta
# Authenticate with your DeepRouter key
export GEMINI_API_KEY=sk-...your-deeprouter-key...
```

Then reload your shell (or open a new terminal window):

```bash
source ~/.zshrc
```

> **Why the `/v1beta` endpoint?** Gemini CLI sends requests in Google's native Gemini format.
> DeepRouter's `…/v1beta` endpoint understands that exact format, so the CLI works unchanged.
> (DeepRouter also has an OpenAI‑style endpoint, but the Gemini CLI doesn't speak that dialect —
> see the fallback note below.)

---

## Step 2 — Run it

Start Gemini CLI in any folder:

```bash
gemini
```

If it tries to walk you through a Google sign‑in, choose the **API key** option (not "log in with
Google") — you're authenticating through DeepRouter, not a Google account.

To use a specific model, set it once:

```bash
export GEMINI_MODEL=gemini-2.5-flash
```

Pick exact model IDs from the console **Model Catalog**.

---

## Verify it's working

Ask Gemini CLI something simple like "say hello." A normal reply means traffic is flowing
through DeepRouter. To confirm, open the DeepRouter console and watch your usage tick up after
a request.

You can also test the endpoint directly with curl — a `200` means you're routed correctly:

```bash
curl "https://api.deeprouter.co/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Say hello from DeepRouter."}]}]
  }'
```

---

## If the Gemini endpoint gives you trouble (OpenAI‑compatible fallback)

Gemini CLI is built and tested against Google's own servers, and Google does **not** officially
support pointing it at third‑party endpoints — so behavior can vary between CLI versions. If the
steps above don't work cleanly on your version, the most reliable path is to route through
DeepRouter's **OpenAI‑compatible** endpoint instead, using a tool that speaks that dialect:

- Use **[Codex CLI](./codex.md)** or **[OpenCode](./opencode.md)** with DeepRouter's
  `https://api.deeprouter.co/v1` endpoint — both are first‑class OpenAI‑protocol clients.
- Or run a local OpenAI‑compatible proxy (e.g. LiteLLM) in front of DeepRouter and point Gemini
  CLI at the proxy.

We'd rather tell you this honestly than have you fight a half‑working setup.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection or 404 errors** | Make sure `GOOGLE_GEMINI_BASE_URL` is exactly `https://api.deeprouter.co/v1beta` — with `/v1beta`, and **no trailing slash**. |
| **Authentication / 401** | The key is wrong or it picked your Google login. Set `GEMINI_API_KEY` to your DeepRouter `sk-...` key and choose the API‑key sign‑in option. |
| **Still going to Google** | A stale env var or an old session is winning. Run `echo $GOOGLE_GEMINI_BASE_URL` to check, then open a fresh terminal so the new values take effect. |
| **Weird parameter errors** | Your Gemini CLI version may be sending fields DeepRouter's endpoint doesn't accept. Use the OpenAI‑compatible fallback above. |
| **`model not found`** | That model isn't enabled for your account. Pick an ID from the console **Model Catalog**. |

---

## Reference

| Item | Value |
|---|---|
| Gemini‑compatible base URL | `https://api.deeprouter.co/v1beta` |
| Env var (endpoint) | `GOOGLE_GEMINI_BASE_URL` |
| Env var (key) | `GEMINI_API_KEY` (use your DeepRouter `sk-...` key) |
| Auth header | `x-goog-api-key: <key>` (sent by the CLI) |
| OpenAI‑compatible fallback base | `https://api.deeprouter.co/v1` |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
