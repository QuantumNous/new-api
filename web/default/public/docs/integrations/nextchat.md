# NextChat (ChatGPT-Next-Web) → DeepRouter

[NextChat](https://github.com/ChatGPTNextWeb/NextChat) (formerly ChatGPT-Next-Web) is a
lightweight chat app you can use in your browser, on your phone, or run on your own server.
It's built to talk to OpenAI-style services, so pointing it at DeepRouter just means setting
a custom endpoint and your key. No code if you're using the app — and if you self-host,
it's two environment variables.

> **TL;DR (in-app)** — open **Settings**, scroll to the model/access section, and fill in:
>
> | Field | Value |
> |---|---|
> | API Endpoint (Custom Endpoint) | `https://api.deeprouter.co` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Model | add one from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |
>
> **TL;DR (self-hosted)** — set env vars `BASE_URL=https://api.deeprouter.co` and
> `OPENAI_API_KEY=sk-...`

---

## Why DeepRouter

One key gives NextChat access to every model in our catalog (Claude, Qwen, GLM, DeepSeek, Kimi and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under
   **API Keys** — it's also shown once on your welcome screen right after signup.

---

## Option A — in the app (no setup)

Use this if you opened someone's hosted NextChat or the desktop app.

1. Open NextChat. Click the gear icon to open **Settings**.
2. Scroll down to the section with **API Endpoint** (sometimes shown as **Custom Endpoint**
   or **接口地址**) and **API Key**.
3. In **API Endpoint**, paste:
   ```
   https://api.deeprouter.co
   ```
   NextChat adds the `/v1/chat/completions` part itself — so here you use the **host only**,
   without `/v1`.
4. In **API Key**, paste your DeepRouter key (`sk-...`).
5. Find **Custom Models** (or **Model**) and add an ID from the DeepRouter console
   **Model Catalog**, using the format `+claude-haiku-4-5@OpenAI`. Then pick it as your
   current model.

---

## Option B — self-hosting (Docker / Vercel)

Use this if you're deploying your own NextChat. Set these two environment variables:

```bash
BASE_URL=https://api.deeprouter.co
OPENAI_API_KEY=sk-your-deeprouter-key
```

Docker example:

```bash
docker run -d -p 3000:3000 \
  -e BASE_URL=https://api.deeprouter.co \
  -e OPENAI_API_KEY=sk-your-deeprouter-key \
  yidadaa/chatgpt-next-web
```

To expose specific models, also set `CUSTOM_MODELS`, e.g.
`CUSTOM_MODELS=+claude-haiku-4-5@OpenAI`.

> NextChat's exact env-var names and settings labels can shift between versions and
> hosting setups — if `BASE_URL` doesn't take, check your version's README for the
> base-URL variable it actually reads.

---

## Verify it's working

1. Start a new chat and pick your DeepRouter model.
2. Ask something simple like "Say hello from DeepRouter."
3. You should get a normal reply. Then open the DeepRouter console — the request should
   show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **404 / "not found"** | You probably added `/v1` to the endpoint. NextChat appends it itself — use the host only: `https://api.deeprouter.co`. |
| **Model not found / no response** | Add the model via **Custom Models** as `+<model-id>@OpenAI` using an ID from the **Model Catalog**, then select it. |
| **Self-host change ignored** | Env vars only apply after a restart/redeploy; confirm the variable name matches your version's README. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Replies still look like OpenAI's** | The custom endpoint/key didn't save, or a built-in model is selected — re-check Settings. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it (app) | NextChat **Settings → API Endpoint + API Key** |
| Where to set it (self-host) | env vars `BASE_URL` + `OPENAI_API_KEY` |
| Base URL / Endpoint | `https://api.deeprouter.co` (host only — NextChat appends `/v1/chat/completions`) |
| Endpoint used | `POST /v1/chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (NextChat sends the key for you) |
| Custom model format | `+<model-id>@OpenAI` (e.g. `+claude-haiku-4-5@OpenAI`) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
