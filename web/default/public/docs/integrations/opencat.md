# OpenCat → DeepRouter

[OpenCat](https://opencat.app) is a polished AI chat app for iPhone, iPad and Mac. It
lets you add your own "custom provider" — which is exactly how you point it at DeepRouter.
You add a provider, paste a web address and your key, pick a model, done. No code,
no terminal.

> **TL;DR** — go to **Settings → API Providers → Add Provider** and fill in:
>
> | Field | Value |
> |---|---|
> | Name | anything you like, e.g. `DeepRouter` |
> | API Host | `https://api.deeprouter.co/v1` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Provider type / Protocol | OpenAI |
> | Model | add one from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key gives OpenCat access to every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under
   **API Keys** — it's also shown once on your welcome screen right after signup.

---

## Steps

1. Open OpenCat. Open **Settings** (the gear icon).
2. Tap **API Providers**, then **Add Provider** (on some versions this reads
   **Custom Provider** or **Add Custom API**).
3. For **Provider type** / **Protocol**, choose **OpenAI**. DeepRouter speaks the
   OpenAI format, so this is the right choice even when you end up chatting with a Claude
   or Qwen model through it.
4. In **Name**, type anything you'll recognise, e.g. `DeepRouter`.
5. In the **API Host** box (you may also see it labelled **Endpoint** or **Base URL**),
   paste:
   ```
   https://api.deeprouter.co/v1
   ```
6. In the **API Key** box, paste your DeepRouter key (`sk-...`).
7. Add a model: if OpenCat doesn't list any automatically, add one by hand using an ID
   from the DeepRouter console **Model Catalog** (for example `claude-haiku-4-5`).
8. Save.

> **Heads-up on field names** — OpenCat tweaks its wording between app versions and
> platforms (iOS vs Mac). The address field is usually **API Host**, but if you only see
> **Endpoint** or **Base URL**, that's the same box — paste `https://api.deeprouter.co/v1`
> into it.

---

## Verify it's working

1. Start a new chat.
2. At the top, pick your DeepRouter provider and model.
3. Ask something simple like "Say hello from DeepRouter."
4. You should get a normal reply. Then open the DeepRouter console — the request should
   show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection / network error** | Check the API Host is exactly `https://api.deeprouter.co/v1` (with `/v1`, no trailing slash). |
| **No models to pick** | Add a model by hand using an ID from the console **Model Catalog**. |
| **Model not found / no response** | That model isn't enabled for your account — pick a different ID from the **Model Catalog**. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Can't find the right setting** | Field names vary by version — look for *Add Provider* / *Custom Provider*, then any field that asks for a host, endpoint, or base URL. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | OpenCat **Settings → API Providers → Add Provider** (Provider type: OpenAI) |
| API Host / Base URL | `https://api.deeprouter.co/v1` |
| API Key | your DeepRouter key (`sk-...`) |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (OpenCat sends the key for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
