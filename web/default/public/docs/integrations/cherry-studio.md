# Cherry Studio → DeepRouter

[Cherry Studio](https://cherry-ai.com) is a friendly desktop chat app (Windows, Mac,
Linux). It lets you add your own "model provider," so you can point it straight at
DeepRouter and chat with our models. No code, no terminal — just a few clicks in Settings.

> **TL;DR** — in **Settings → Model Providers → Add**, create an **OpenAI**-type provider with:
>
> | Field | Value |
> |---|---|
> | Provider type | **OpenAI** |
> | API host (API address) | `https://api.deeprouter.co` |
> | API key | your DeepRouter key (`sk-...`) |
> | Model | add one from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to see your usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`). Find it in the console under **API Keys**
   (it's also shown once on your welcome screen right after signup).
3. **Cherry Studio** installed on your computer.

---

## Steps

1. Open Cherry Studio. Click the **Settings** (gear ⚙️) icon in the left sidebar.
2. Open the **Model Providers** tab (sometimes shown as "Model Services").
3. At the bottom of the provider list, click **+ Add**.
4. Give it a name you'll recognise — for example **DeepRouter** — and for **Provider type** choose **OpenAI**. Click **OK / Add**.
5. With your new DeepRouter provider selected, fill in:
   - **API key**: your DeepRouter key (`sk-...`)
   - **API host** (a.k.a. *API address* / *Base URL*): `https://api.deeprouter.co`
6. Scroll to the **Models** section and click **+ Add** (or **Manage**). Type a model ID
   from the DeepRouter console **Model Catalog**, for example `claude-haiku-4-5`, and add it.
7. Make sure the provider's toggle (top of its panel) is switched **on**.

### One thing to know about the API host slash

Cherry Studio has a small rule about the address you paste:

- If the host **does not** end in a slash (like `https://api.deeprouter.co`), Cherry Studio
  automatically appends **`/v1`** for you — this is what you want, and it gives the correct
  `https://api.deeprouter.co/v1`.
- If you add a **trailing slash** (`https://api.deeprouter.co/v1/`), Cherry Studio uses that
  address **exactly as typed** and does **not** add anything. So if you'd rather spell out
  `/v1` yourself, write `https://api.deeprouter.co/v1/` with the trailing slash.

Either form works — just don't write `https://api.deeprouter.co/v1` *without* the trailing
slash, or you'll end up with a doubled `/v1/v1`.

---

## Verify it's working

1. Back in the provider panel, click the **Check** button next to the API key (Cherry Studio
   pings the provider to confirm the key and address). A success message means you're connected.
2. Start a **new chat**, pick your DeepRouter model from the model selector, and ask something
   simple like "Say hello from DeepRouter."
3. Open the DeepRouter console — the request should show up in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **"Check" fails / connection error** | Use `https://api.deeprouter.co` (no trailing slash, lets Cherry add `/v1`) **or** `https://api.deeprouter.co/v1/` (with trailing slash). Don't use `/v1` without a trailing slash. |
| **404 or doubled path in errors** | You likely typed `…/v1` with no trailing slash, so it became `/v1/v1`. Remove the `/v1` and let Cherry add it. |
| **401 / auth error** | Key is wrong, revoked, or out of quota — check **API Keys** and billing in the console. |
| **Model not found** | Use an exact model ID from the console **Model Catalog**. |
| **Provider greyed out / no models listed** | Turn the provider's on/off toggle **on**, then add at least one model under **Models**. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | Cherry Studio **Settings → Model Providers → Add (type: OpenAI)** |
| API host | `https://api.deeprouter.co` (Cherry appends `/v1`) |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (Cherry sends it for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
