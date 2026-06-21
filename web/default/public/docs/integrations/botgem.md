# BotGem → DeepRouter

[BotGem](https://botgem.com) is a desktop AI chat client. It includes an **OpenAI API
Compatible** provider option, and DeepRouter speaks exactly that format — so you can point
BotGem at DeepRouter by entering one web address, your key, and a model name. No code, no terminal.

> **TL;DR** — in **Settings → Service Provider → OpenAI API Compatible**, fill in:
>
> | Field | Value |
> |---|---|
> | Base URL | `https://api.deeprouter.co/v1` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Model | from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to see your usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. **BotGem** installed on your computer.

---

## Steps

1. Open BotGem and go to **Settings**.
2. Open the **Service Provider** section.
3. In the provider list, choose **OpenAI API Compatible**.
4. Fill in the fields:
   - **Base URL**: `https://api.deeprouter.co/v1`
   - **API Key**: your DeepRouter key (`sk-...`)
   - **Model List**: add a model ID from the DeepRouter console **Model Catalog**, e.g.
     `claude-haiku-4-5`.
5. Click **Save**.

> **Heads-up on versions:** BotGem's exact labels and layout can shift between releases.
> The important part is the **OpenAI API Compatible** provider plus the **Base URL** above —
> if your version words a field a little differently (e.g. "API endpoint" instead of
> "Base URL"), it's the same setting.

### If a request fails, try the address without `/v1`

Most OpenAI-compatible clients want the base URL **with** `/v1`
(`https://api.deeprouter.co/v1`) and append `/chat/completions` themselves. A few clients
add `/v1` for you. If you see a 404 or a doubled-path error, switch the Base URL to the bare
host **`https://api.deeprouter.co`** instead — make sure `/v1` ends up in the address exactly once.

---

## Verify it's working

1. Start a **new chat**, select your DeepRouter model, and ask something simple like
   "Say hello from DeepRouter."
2. You should get a normal reply.
3. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection error / 404** | Try `https://api.deeprouter.co/v1` first; if that fails, use the bare host `https://api.deeprouter.co`. Make sure `/v1` appears exactly once. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Model not found / empty reply** | Use an exact model ID from the console **Model Catalog**, and make sure that model is selected. |
| **Can't find the field** | Look under **Settings → Service Provider → OpenAI API Compatible**; field names may vary slightly by BotGem version. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | BotGem **Settings → Service Provider → OpenAI API Compatible** |
| Base URL | `https://api.deeprouter.co/v1` (or bare host `https://api.deeprouter.co`) |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (BotGem sends it for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
