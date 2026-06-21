# WorkBuddy → DeepRouter

**WorkBuddy** (Tencent's AI assistant, the international edition of CodeBuddy) lets you add
your own models that point at any OpenAI-compatible service. DeepRouter is one of those, so
you can route WorkBuddy through DeepRouter by adding a custom model with our address and your
key.

> ⚠️ **Honest note:** WorkBuddy's setup screens and config field names change between
> versions and platforms. The steps below reflect the custom-model pattern WorkBuddy
> documents today (a `models.json` config file). If your version shows an in-app
> "Add custom model / provider" screen instead, the values to enter are the same — just
> match them to whatever fields it shows. **We haven't pinned every menu label, so treat
> exact wording as version-dependent.**

> **TL;DR** — add a custom model whose endpoint points at DeepRouter:
>
> | Setting | Value |
> |---|---|
> | url (endpoint) | `https://api.deeprouter.co/v1/chat/completions` |
> | apiKey | your DeepRouter key (`sk-...`) |
> | id | a model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |
> | vendor | `OpenAI` (DeepRouter speaks the OpenAI format) |

---

## Why DeepRouter

One key gives WorkBuddy access to every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under
   **API Keys** — it's also shown once on your welcome screen right after signup.

---

## Steps (config-file method)

1. Install and sign in to WorkBuddy. Open a project folder once so it can create its
   config directory.
2. Find (or create) the config file `models.json`. WorkBuddy looks for it in two places:
   - **Per user:** `~/.codebuddy/models.json` (on Windows: `C:\Users\<you>\.codebuddy\models.json`)
   - **Per project:** `<your-project>/.codebuddy/models.json`
3. Add a model entry pointing at DeepRouter. Replace the model ID with one from the
   DeepRouter console **Model Catalog**:
   ```json
   {
     "availableModels": ["deeprouter-claude-haiku"],
     "models": {
       "deeprouter-claude-haiku": {
         "id": "claude-haiku-4-5",
         "name": "DeepRouter — Claude Haiku 4.5",
         "vendor": "OpenAI",
         "url": "https://api.deeprouter.co/v1/chat/completions",
         "apiKey": "sk-your-deeprouter-key",
         "maxInputTokens": 200000,
         "maxOutputTokens": 8192
       }
     }
   }
   ```
   - `id` is the exact model name DeepRouter knows (from the **Model Catalog**).
   - `vendor` is `OpenAI` because DeepRouter exposes models over the OpenAI format.
   - `url` is the **full** OpenAI-compatible endpoint, including `/v1/chat/completions`.
4. Save the file as **UTF-8 without BOM** (a stray byte-order mark can make WorkBuddy
   refuse to read it).
5. **Fully restart** WorkBuddy, then pick your new model from the model selector.

> Prefer not to hardcode the key? WorkBuddy supports environment-variable references in
> `apiKey`, e.g. `"apiKey": "${DEEPROUTER_API_KEY}"` after you set that variable on your
> machine.

---

## Verify it's working

1. Open WorkBuddy's chat and select your DeepRouter model from the model selector.
2. Ask something simple like "Say hello from DeepRouter."
3. You should get a normal reply. Then open the DeepRouter console — the request should
   show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Model doesn't appear** | The config didn't load. Save as UTF-8 **without BOM** and fully restart WorkBuddy. |
| **404 / "not found"** | The `url` must be the full endpoint `https://api.deeprouter.co/v1/chat/completions`, not just the host. |
| **Model not found / no response** | The `id` must match a model from the console **Model Catalog** exactly. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Fields look different in your version** | Wording varies by version/platform. Map the same four values — endpoint, key, model id, OpenAI vendor — onto whatever your screen shows. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | WorkBuddy `models.json` (per-user `~/.codebuddy/` or per-project `.codebuddy/`), or an in-app custom-model screen |
| url (endpoint) | `https://api.deeprouter.co/v1/chat/completions` |
| apiKey | your DeepRouter key (`sk-...`) |
| id (model) | from DeepRouter console **Model Catalog** (e.g. `claude-haiku-4-5`) |
| vendor | `OpenAI` (OpenAI-compatible format) |
| Auth | `Authorization: Bearer <key>` (WorkBuddy sends the key for you) |
| Get a key | DeepRouter console → **API Keys** |
