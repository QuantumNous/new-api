# Chatbox → DeepRouter

[Chatbox](https://chatboxai.app) is a simple desktop (and web) AI chat app. It can talk to
any "OpenAI-compatible" service, which is exactly what DeepRouter is — so you just add a
custom provider, paste a web address and your key, and start chatting. No code, no terminal.

> **TL;DR** — in **Settings → Model Provider → Add**, choose **OpenAI API Compatible** and fill in:
>
> | Field | Value |
> |---|---|
> | API Host | `https://api.deeprouter.co/v1` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Model | from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key gives Chatbox every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to track your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. **Chatbox** installed (or open the web version).

---

## Steps

1. Open Chatbox. Click **Settings** (gear ⚙️ icon).
2. Open the **Model Provider** dropdown and choose **Add** (or **Add Custom Provider**).
3. Give the provider a name you'll recognise, e.g. **DeepRouter**.
4. For **API Mode / provider type**, choose **OpenAI API Compatible**.
5. Fill in the fields:
   - **API Host**: `https://api.deeprouter.co/v1`
   - **API Key**: your DeepRouter key (`sk-...`)
   - **API Path**: leave this **blank** — Chatbox uses `/chat/completions` by default.
6. Add at least one **Model** by typing a model ID from the DeepRouter console
   **Model Catalog**, e.g. `claude-haiku-4-5`.
7. Click **Save** (and **Check**, if shown, to test the connection).

### A note on the address (two valid forms)

Chatbox builds the final request as **API Host + API Path**, where the default path is
`/chat/completions`. Two setups both work:

- **Simplest:** API Host = `https://api.deeprouter.co/v1`, API Path = *(blank)*. Final URL =
  `https://api.deeprouter.co/v1/chat/completions`. ✅
- **Bare host:** some Chatbox versions default the path to `/v1/chat/completions`. In that
  case put API Host = `https://api.deeprouter.co` (no `/v1`). If you put `/v1` in **both**
  the host and the path you'll get a doubled `/v1/v1` — only include it once.

If a request fails, the quickest fix is to check whether `/v1` appears exactly **once** in
the full address.

---

## Verify it's working

1. Start a **new chat** and pick your DeepRouter model from the model selector.
2. Ask something simple like "Say hello from DeepRouter." You should get a normal reply.
3. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Connection error / 404** | Make sure `/v1` appears **once** across API Host + API Path. Easiest: Host `https://api.deeprouter.co/v1`, Path blank. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Model not found / empty reply** | Use an exact model ID from the console **Model Catalog**, and make sure that model is selected in the chat. |
| **Nothing happens on send** | Confirm provider type is **OpenAI API Compatible** and the provider is selected/enabled. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | Chatbox **Settings → Model Provider → Add → OpenAI API Compatible** |
| API Host | `https://api.deeprouter.co/v1` (with API Path left blank) |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (Chatbox sends it for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
