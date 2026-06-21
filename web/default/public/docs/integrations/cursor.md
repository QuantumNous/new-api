# Cursor → DeepRouter

Point [Cursor](https://cursor.com)'s chat at DeepRouter so it talks to our models
instead of going straight to OpenAI. Cursor has a built-in setting for exactly this —
you flip one toggle, paste a web address, and paste your key. No code, no terminal.

> **TL;DR** — in **Settings → Models**, turn on **Override OpenAI Base URL** and fill in:
>
> | Field | Value |
> |---|---|
> | OpenAI Base URL | `https://api.deeprouter.co/v1` |
> | OpenAI API Key | your DeepRouter key (`sk-...`) |
> | Model | add one from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key gives Cursor access to every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under
   **API Keys** — it's also shown once on your welcome screen right after signup.

---

## Steps

1. Open Cursor. Open **Settings** (press **Cmd + ,** on Mac, **Ctrl + ,** on Windows/Linux).
2. In the left sidebar, click **Models**.
3. Scroll down to the **OpenAI API Key** section.
4. Turn on the **Override OpenAI Base URL** toggle.
5. In the **Base URL** box, paste:
   ```
   https://api.deeprouter.co/v1
   ```
6. In the **OpenAI API Key** box, paste your DeepRouter key (`sk-...`).
7. Scroll up to the model list. Click **Add Model** and type a model ID from the
   DeepRouter console **Model Catalog** (for example `claude-haiku-4-5`). Make sure
   it's the only model toggled on, so Cursor doesn't try to use a model we don't serve.
8. Click **Verify** (next to the key field). A success message means you're connected.

---

## One honest heads-up about Cursor

Cursor's most powerful, Cursor-hosted features — **Tab autocomplete, Composer/agent,
inline edit, and Apply** — are tuned to Cursor's own backend and **do not run through a
custom OpenAI base URL**. When you override the base URL, the **Chat / Ask panel** is what
uses your DeepRouter key and models. Everything else may fall back to Cursor's service or
stop working until you turn the override off.

So: use this when you want Cursor's chat answered by DeepRouter models. If you rely heavily
on Tab/Composer, keep that in mind — this is a Cursor limitation, not a DeepRouter one.

---

## Verify it's working

1. Open the Cursor **Chat** panel (the chat icon, or **Cmd/Ctrl + L**).
2. Pick your DeepRouter model from the model dropdown at the bottom of the chat box.
3. Ask something simple like "Say hello from DeepRouter."
4. You should get a normal reply. Then open the DeepRouter console — you should see the
   request show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **"Verify" fails / connection error** | Double-check the Base URL is exactly `https://api.deeprouter.co/v1` (with `/v1`, no trailing slash) and the key is correct. |
| **Model not found / no response** | The model isn't enabled for your account. Pick an ID straight from the console **Model Catalog**. |
| **Tab / Composer / Apply stopped working** | Expected — those are Cursor-hosted and don't use a custom base URL. Turn the override off to get them back. |
| **Replies still look like OpenAI's** | The override toggle is off, or a built-in Cursor model is selected. Re-check the toggle and select your DeepRouter model in the chat dropdown. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | Cursor **Settings → Models → Override OpenAI Base URL** |
| Base URL | `https://api.deeprouter.co/v1` |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (Cursor sends the key for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
