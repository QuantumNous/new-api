# Claude Cowork → DeepRouter

**Claude Cowork** (sometimes written "Claude Coworks") is Anthropic's desktop app for working
with Claude on everyday knowledge work — not just coding. Newer builds include a
**Third-Party Inference** mode that lets you route Claude Cowork through an outside gateway
instead of Anthropic's cloud. DeepRouter can be that gateway, because it speaks Claude's
**native Anthropic format**.

> **TL;DR** — turn on Developer Mode, open **Configure Third-Party Inference → Gateway**, and fill in:
>
> | Field | Value |
> |---|---|
> | Gateway base URL | `https://api.deeprouter.co` |
> | Gateway API key | your DeepRouter key (`sk-...`) |
> | Gateway auth scheme | `bearer` |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to see your usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. The **Claude Cowork** desktop app installed.

> **Honest note:** Third-Party Inference is a developer-mode feature and Anthropic adjusts it
> over time. The menu wording below matches recent builds; if your version words things a
> little differently, look for "Developer Mode" and "Third-Party Inference / Gateway." The
> DeepRouter values stay the same.

---

## Steps

1. Open Claude Cowork.
2. Enable Developer Mode: **Help → Troubleshooting → Enable Developer Mode**.
3. Open the **Developer** menu → **Configure Third-Party Inference**.
4. For the inference backend, choose **Gateway**.
5. Fill in:
   - **Gateway base URL**: `https://api.deeprouter.co`
     *(no `/v1` here — DeepRouter's Anthropic endpoint appends `/v1/messages` itself.)*
   - **Gateway API key**: your DeepRouter key (`sk-...`)
   - **Gateway auth scheme**: `bearer`
6. Save / apply, and restart the app if it asks you to.

### Why no `/v1`

Claude Cowork talks Anthropic's native **Messages** protocol — it sends
`POST /v1/messages`. DeepRouter's Anthropic-native base URL is the **bare host**
`https://api.deeprouter.co`, and it adds `/v1/messages` for you. Adding `/v1` yourself would
double it up.

### Pick a Claude model

Because this path is Anthropic-native, choose a **Claude** model that exists in your
DeepRouter **Model Catalog** (e.g. `claude-haiku-4-5`). Non-Claude models aren't served over
the Anthropic Messages format.

---

## Verify it's working

1. Start a normal chat in Claude Cowork and ask something simple like
   "Say hello from DeepRouter."
2. You should get a normal reply.
3. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Can't find the setting** | Enable **Developer Mode** first (**Help → Troubleshooting**), then look under the **Developer** menu. |
| **Connection error / 404** | Base URL must be `https://api.deeprouter.co` — **no** `/v1`, no trailing slash. DeepRouter appends `/v1/messages`. |
| **401 / auth error** | Set auth scheme to **bearer**, and check the key is correct and has quota (**API Keys** + billing). |
| **Model not found** | Use a **Claude** model ID from the console **Model Catalog** (the Anthropic path only serves Claude models). |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | Claude Cowork **Developer → Configure Third-Party Inference → Gateway** |
| Gateway base URL | `https://api.deeprouter.co` (no `/v1`) |
| Endpoint used | `POST /v1/messages` (Anthropic-native, auto-appended) |
| Auth | `Authorization: Bearer <key>` (scheme: `bearer`) |
| Model IDs | DeepRouter console → **Model Catalog** (Claude models) |
| Get a key | DeepRouter console → **API Keys** |
