# Zed → DeepRouter

[Zed](https://zed.dev) is a fast code editor with a built-in AI assistant. Zed lets you add
your own **OpenAI-compatible** model provider, so you can point its assistant at DeepRouter.
You do this by adding a small block to Zed's `settings.json` — Zed has a menu item that opens
that file for you, so you don't have to hunt for it.

> **TL;DR** — in Zed's `settings.json`, add an `openai_compatible` provider:
>
> | Field | Value |
> |---|---|
> | `api_url` | `https://api.deeprouter.co/v1` |
> | API key | your DeepRouter key (`sk-...`) — entered in the UI, stored in your keychain |
> | model `name` | from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with smart routing and a single place to watch your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (also shown once on your welcome screen after signup).

---

## Steps

1. Open Zed. Open the command palette (**Cmd + Shift + P** on Mac, **Ctrl + Shift + P** on
   Windows/Linux) and run **zed: open settings**. This opens `settings.json`.
2. Add (or merge into) a `language_models` block like this:

   ```json
   {
     "language_models": {
       "openai_compatible": {
         "DeepRouter": {
           "api_url": "https://api.deeprouter.co/v1",
           "available_models": [
             {
               "name": "claude-haiku-4-5",
               "display_name": "DeepRouter — Claude Haiku 4.5",
               "max_tokens": 200000
             }
           ]
         }
       }
     }
   }
   ```

   - `"DeepRouter"` is just the label you'll see in Zed — name it whatever you like.
   - Set `"name"` to a real model ID from the console **Model Catalog**. Add more entries to
     the `available_models` list for more models.
3. Save the file.
4. Now add your **key**. Open the **Agent / Assistant** panel, click the settings/gear icon,
   find your **DeepRouter** provider in the list, and paste your API key (`sk-...`) when prompted.
   Zed stores it securely in your system keychain — it does **not** go into `settings.json`.

> **Tip:** Zed can also read the key from an environment variable named after the provider ID,
> in upper snake case + `_API_KEY`. For a provider named `DeepRouter` that's `DEEPROUTER_API_KEY`.
> Setting that before launching Zed works as an alternative to pasting it in the UI.

---

## Verify it's working

1. Open Zed's **Agent / Assistant** panel.
2. In the model picker, choose your DeepRouter model (it appears under the provider label you set).
3. Ask something simple like "Say hello from DeepRouter."
4. You should get a normal reply, and the request should show up in your DeepRouter console usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Provider doesn't appear** | Re-check `settings.json` for a JSON typo (missing comma/brace). Zed shows a red squiggle on bad JSON. |
| **Auth / 401 error** | Make sure you pasted the key in the Agent settings (or set `DEEPROUTER_API_KEY`) and that it has quota in the console. |
| **Connection error** | `api_url` must be exactly `https://api.deeprouter.co/v1` (with `/v1`, no trailing slash). |
| **Model not found** | The `name` must be a real ID from the console **Model Catalog**. |
| **Key not saved** | Zed keeps the key in the keychain, not in `settings.json` — set it via the Agent settings UI, not the file. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | Zed `settings.json` → `language_models.openai_compatible` |
| `api_url` | `https://api.deeprouter.co/v1` |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (Zed sends it for you) |
| Key storage | system keychain or `DEEPROUTER_API_KEY` env var — never in `settings.json` |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
