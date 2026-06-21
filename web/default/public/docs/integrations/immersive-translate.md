# Immersive Translate → DeepRouter

[Immersive Translate](https://immersivetranslate.com) is a browser extension that
translates web pages, PDFs and subtitles side-by-side. It lets you bring your own AI
translation service, so you can have it translate using a model routed through
DeepRouter. You do this by adding a **custom OpenAI-compatible service** in its settings.

> **TL;DR** — In Immersive Translate settings, add a custom OpenAI-compatible service:
>
> | Field | Value |
> |---|---|
> | Custom API Endpoint | `https://api.deeprouter.co/v1/chat/completions` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Model Name | a model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |
>
> Note: this extension wants the **full** endpoint path ending in `/chat/completions`,
> not just the base URL.

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to track usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (`sk-...`) from the console under **API Keys** (also shown
   once on your welcome screen after signup).
3. The **Immersive Translate** extension installed in your browser.

---

## Add DeepRouter as a custom service

1. Open Immersive Translate **Settings** (click the extension icon → settings/gear, or
   open the extension's options page).
2. Go to **Translation Services**.
3. Scroll to the bottom and click **"Add Custom AI Translation Service Compatible with
   OpenAI Interface?"** (wording may vary slightly by version — look for the option to
   add a *custom OpenAI-compatible* service).
4. Fill in the fields:
   - **Custom Translation Service Name**: anything you like, e.g. `DeepRouter` — this is
     just a label so you can pick it from the service list later.
   - **Custom API Endpoint**: `https://api.deeprouter.co/v1/chat/completions`
     *(Important: paste the **full** URL including `/v1/chat/completions`. This extension
     expects the complete endpoint, not just the base `…/v1`.)*
   - **API Key**: paste your DeepRouter key (`sk-...`).
   - **Model Name**: a model ID from the console **Model Catalog**, e.g. `claude-haiku-4-5`.
     Use the exact ID.
5. Some versions also expose advanced options like *max requests per second* or *paragraphs
   per request* — the defaults are fine to start.
6. Use the **test** button (usually top-right of the form) to confirm the connection works.
7. Save, then make sure **DeepRouter** is selected as the active translation service.

---

## Verify it's working

1. Open any foreign-language web page and trigger a translation (the extension's
   translate button, or its keyboard shortcut).
2. You should see the translated text appear alongside the original.
3. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Auth / 401 error** | Check the key (`sk-...`) and that it has quota in the console (**API Keys** + billing). |
| **404 / connection error** | The endpoint must be the **full** path `https://api.deeprouter.co/v1/chat/completions` — not just `…/v1`, and not the bare host. |
| **Model not found** | Use an exact model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`). |
| **Test button fails but key is correct** | Re-paste the endpoint carefully (no trailing space, no extra slash) and make sure the model name is one your account can access. |
| **Rate-limit / 429 errors on big pages** | Lower the "max requests per second" / "paragraphs per request" in the service's advanced options. |

---

## Reference

| Item | Value |
|---|---|
| Service type | Custom OpenAI-compatible |
| Custom API Endpoint | `https://api.deeprouter.co/v1/chat/completions` (full path) |
| API Key | your DeepRouter key (`sk-...`) |
| Model Name | from console → **Model Catalog** |
| Auth header sent | `Authorization: Bearer <key>` |
| Get a key | console → **API Keys** |
