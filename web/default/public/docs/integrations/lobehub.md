# LobeChat / LobeHub → DeepRouter

[LobeChat](https://lobehub.com) (also called LobeHub) is a friendly chat app you can
run in your browser or as a desktop app. It already knows how to talk to "OpenAI-style"
services — and DeepRouter is one of those. So pointing it at DeepRouter is just: paste a
web address, paste your key, turn on a model. No code, no terminal.

> **TL;DR** — go to **Settings → AI Service Provider → OpenAI**, turn it **on**, and fill in:
>
> | Field | Value |
> |---|---|
> | API Key | your DeepRouter key (`sk-...`) |
> | API Proxy Address (Base URL) | `https://api.deeprouter.co/v1` |
> | Model | add one from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key gives LobeChat access to every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under
   **API Keys** — it's also shown once on your welcome screen right after signup.

---

## Steps

1. Open LobeChat. Click your avatar / the gear icon to open **Settings**.
2. In the left sidebar, click **AI Service Provider** (some versions call this section
   **Language Model**).
3. From the list of providers, click **OpenAI**.
4. Turn the provider **on** with the **Enable** toggle at the top.
5. In the **API Key** box, paste your DeepRouter key (`sk-...`).
6. Find the **API Proxy Address** box (it may also be labelled **Base URL** or
   **API Endpoint**) and paste:
   ```
   https://api.deeprouter.co/v1
   ```
7. Scroll to the model list. Either click **Get Model List** to pull the available
   models, or click **Add Custom Model** and type a model ID from the DeepRouter console
   **Model Catalog** (for example `claude-haiku-4-5`). Toggle it **on**.
8. (Optional) Click **Check** next to the key field to test the connection.

> **About that `/v1`** — LobeChat lets you set the base URL by hand, and whether you
> include `/v1` matters. For DeepRouter, **keep the `/v1`** (`https://api.deeprouter.co/v1`).
> If you ever get blank replies, that's the first thing to re-check.

---

## Verify it's working

1. Start a new chat.
2. In the model picker at the top of the chat, choose your DeepRouter model.
3. Ask something simple like "Say hello from DeepRouter."
4. You should get a normal reply. Then open the DeepRouter console — the request should
   show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Blank / empty reply** | Almost always the `/v1`. Make sure the base URL is exactly `https://api.deeprouter.co/v1`. |
| **"Connection failed" on Check** | Re-check the base URL (no trailing slash) and that the key is pasted correctly. |
| **No models in the list** | Click **Add Custom Model** and type an ID straight from the console **Model Catalog**, then toggle it on. |
| **Model not found / no response** | That model isn't enabled for your account — pick a different ID from the **Model Catalog**. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | LobeChat **Settings → AI Service Provider → OpenAI** |
| API Key | your DeepRouter key (`sk-...`) |
| Base URL | `https://api.deeprouter.co/v1` (keep the `/v1`) |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (LobeChat sends the key for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
