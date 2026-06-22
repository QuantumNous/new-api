# OpenCode → DeepRouter

Point SST's [OpenCode](https://opencode.ai) at DeepRouter so its requests run through your
DeepRouter account instead of going straight to a model vendor. OpenCode lets you add your own
**OpenAI‑compatible provider**, and DeepRouter ships exactly that — so this is a small config
file plus one API key, no coding required.

> **TL;DR** — add a provider to your `opencode.json` and one API key.
> ```json
> {
>   "$schema": "https://opencode.ai/config.json",
>   "provider": {
>     "deeprouter": {
>       "npm": "@ai-sdk/openai-compatible",
>       "name": "DeepRouter",
>       "options": {
>         "baseURL": "https://api.deeprouter.co/v1",
>         "apiKey": "{env:DEEPROUTER_API_KEY}"
>       },
>       "models": { "claude-haiku-4-5": { "name": "Claude Haiku 4.5" } }
>     }
>   }
> }
> ```
> ```bash
> export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
> ```

---

## Why route OpenCode through DeepRouter

- **One key, every model.** Claude, GPT‑family, and many open models — all reachable through the
  same OpenAI‑shaped endpoint, with automatic model routing and fallback.
- **Smart routing.** DeepRouter picks the right model and channel per request and fails over
  automatically when an upstream is down.
- **Billing in one place.** Your team's usage, spend, and logs all live in the DeepRouter console.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (it starts with `sk-`). Get it from the console:
   **API Keys** page (it's also shown once on your welcome screen right after signup).
3. OpenCode installed:
   ```bash
   npm install -g opencode-ai
   ```

---

## Step 1 — Open (or create) your OpenCode config file

You have two choices for where the config lives:

- **Just for one project:** `opencode.json` in that project's root folder.
- **For everything you do:** `~/.config/opencode/opencode.json` in your home folder.

Pick one. If the file (or the `~/.config/opencode` folder) doesn't exist yet, create it.

---

## Step 2 — Add DeepRouter as a provider

Paste this into the file:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deeprouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepRouter",
      "options": {
        "baseURL": "https://api.deeprouter.co/v1",
        "apiKey": "{env:DEEPROUTER_API_KEY}"
      },
      "models": {
        "claude-haiku-4-5": { "name": "Claude Haiku 4.5" }
      }
    }
  }
}
```

What each part does, in plain terms:

- **`npm`** — tells OpenCode to use its built‑in OpenAI‑compatible adapter, which is the dialect
  DeepRouter's `/v1` endpoint speaks.
- **`name`** — the label you'll see in OpenCode's model picker.
- **`baseURL`** — where requests go. Use exactly `https://api.deeprouter.co/v1` (no trailing slash);
  OpenCode adds `/chat/completions` for you.
- **`apiKey`** — `{env:DEEPROUTER_API_KEY}` means "read the key from that environment variable,"
  so the secret never sits in the file.
- **`models`** — the menu of models this provider offers. Add one entry per model ID you want to
  use; copy exact IDs from the console **Model Catalog**.

To offer more models, just add more lines under `models`:

```json
"models": {
  "claude-haiku-4-5": { "name": "Claude Haiku 4.5" },
  "gpt-5-mini": { "name": "GPT-5 mini" }
}
```

---

## Step 3 — Put your key in the environment

Add your DeepRouter key to your shell profile (`~/.zshrc`, `~/.bashrc`, or your fish config):

```bash
export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
```

Then reload your shell (or open a new terminal window):

```bash
source ~/.zshrc
```

> Prefer not to use an environment variable? You can paste the key straight into the file as
> `"apiKey": "sk-...your-key..."` — but then keep that file private and out of any git repo.

---

## Verify it's working

Start OpenCode:

```bash
opencode
```

Open the model picker and choose **DeepRouter → Claude Haiku 4.5** (or whichever model you added),
then ask it something simple like "say hello." A normal reply means traffic is flowing through
DeepRouter. To confirm, open the DeepRouter console and watch your usage tick up.

You can also test the endpoint directly with curl — a `200` means you're routed correctly:

```bash
curl https://api.deeprouter.co/v1/chat/completions \
  -H "Authorization: Bearer $DEEPROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection or 404 errors** | Make sure `baseURL` is exactly `https://api.deeprouter.co/v1` — with `/v1`, and **no trailing slash**. |
| **Authentication / 401** | The key is wrong or empty. Check `DEEPROUTER_API_KEY` is set (`echo $DEEPROUTER_API_KEY`) and matches the `{env:...}` name in the file. |
| **DeepRouter doesn't appear in the picker** | The `opencode.json` has a typo or is in a folder OpenCode doesn't read. Re‑check the JSON is valid and the file location (project root or `~/.config/opencode/`). |
| **Key not picked up** | If you set the key in your shell, restart OpenCode from a fresh terminal so it inherits the new value. |
| **`model not found`** | The model ID in `models` isn't enabled for your account. Pick an ID from the console **Model Catalog**. |

---

## Reference

| Item | Value |
|---|---|
| Config file | `opencode.json` (project root) or `~/.config/opencode/opencode.json` |
| Adapter (`npm`) | `@ai-sdk/openai-compatible` |
| OpenAI‑compatible base URL | `https://api.deeprouter.co/v1` |
| Endpoint | `POST /chat/completions` (appended by OpenCode) |
| Auth | `Authorization: Bearer <key>` (from `apiKey`) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
