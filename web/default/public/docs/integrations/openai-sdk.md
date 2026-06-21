# OpenAI SDK → DeepRouter

The official **OpenAI SDKs** (for Python and for Node/TypeScript) are the standard way
people call OpenAI from code. DeepRouter speaks the same OpenAI-compatible API, so you
don't need a different library — you just point the SDK at DeepRouter by changing two
things: the **base URL** and the **API key**. Your existing code keeps working.

> **TL;DR** — Set the base URL to `https://api.deeprouter.co/v1` and use your DeepRouter
> key (`sk-...`).
>
> | SDK | Base URL param | Key param |
> |---|---|---|
> | Python | `base_url="https://api.deeprouter.co/v1"` | `api_key="sk-..."` |
> | Node / TS | `baseURL: "https://api.deeprouter.co/v1"` | `apiKey: "sk-..."` |
>
> Or skip the code and set env vars: `OPENAI_BASE_URL=https://api.deeprouter.co/v1` and
> `OPENAI_API_KEY=sk-...`.

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to track usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (`sk-...`) from the console under **API Keys** (also shown
   once on your welcome screen after signup).
3. The official OpenAI SDK installed:
   - Python: `pip install openai`
   - Node: `npm install openai`

---

## Python

```python
from openai import OpenAI

# Point the client at DeepRouter instead of OpenAI.
client = OpenAI(
    base_url="https://api.deeprouter.co/v1",  # where requests go
    api_key="sk-...",                          # your DeepRouter key
)

# A normal chat request — same shape as with OpenAI.
response = client.chat.completions.create(
    model="claude-haiku-4-5",   # a model ID from the console Model Catalog
    messages=[
        {"role": "user", "content": "Say hello from DeepRouter."},
    ],
)

print(response.choices[0].message.content)
```

What each line does:
- `base_url` tells the SDK to send requests to DeepRouter's OpenAI-compatible endpoint.
- `api_key` is your DeepRouter key — it's sent as `Authorization: Bearer sk-...`.
- `model` is whichever model you picked from the console **Model Catalog**.

---

## Node / TypeScript

```js
import OpenAI from "openai";

// Point the client at DeepRouter instead of OpenAI.
const client = new OpenAI({
  baseURL: "https://api.deeprouter.co/v1", // where requests go
  apiKey: "sk-...",                         // your DeepRouter key
});

// A normal chat request — same shape as with OpenAI.
const response = await client.chat.completions.create({
  model: "claude-haiku-4-5", // a model ID from the console Model Catalog
  messages: [
    { role: "user", content: "Say hello from DeepRouter." },
  ],
});

console.log(response.choices[0].message.content);
```

Note the spelling differs from Python: Node uses **`baseURL`** and **`apiKey`**
(camelCase), Python uses **`base_url`** and **`api_key`** (snake_case).

---

## Or just use environment variables (no code change)

Both SDKs read these env vars automatically, so you can leave your code as-is and only
set the environment:

```bash
export OPENAI_BASE_URL="https://api.deeprouter.co/v1"
export OPENAI_API_KEY="sk-..."
```

Then `OpenAI()` (Python) or `new OpenAI()` (Node) with no arguments will already point
at DeepRouter. This is handy when you don't want your key written into the source code.

---

## Verify it's working

1. Run the snippet above (or a one-liner with your env vars set). You should get a reply.
2. Open the DeepRouter console — the request should appear in your usage/logs.

Quick command-line smoke test (no SDK needed):

```bash
curl https://api.deeprouter.co/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Auth / 401 error** | Check the key (`sk-...`) and that it has quota in the console (**API Keys** + billing). If using env vars, make sure `OPENAI_API_KEY` is exported in the same shell. |
| **Connection / 404 error** | The base URL must be `https://api.deeprouter.co/v1` (with `/v1`). |
| **Model not found** | Use an exact model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`). |
| **Still hitting api.openai.com** | A stale `OPENAI_BASE_URL` (or a base URL hard-coded elsewhere) is overriding you. Print the value you're actually passing. |
| **`base_url` vs `baseURL` error** | Python = `base_url` / `api_key`; Node = `baseURL` / `apiKey`. Don't mix them. |

---

## Reference

| Item | Python | Node / TS |
|---|---|---|
| Base URL param | `base_url` | `baseURL` |
| Key param | `api_key` | `apiKey` |
| Base URL value | `https://api.deeprouter.co/v1` | same |
| Endpoint | `POST /chat/completions` | same |
| Env vars | `OPENAI_BASE_URL`, `OPENAI_API_KEY` | same |
| Auth header sent | `Authorization: Bearer <key>` | same |
| Model IDs | console → **Model Catalog** | same |
| Get a key | console → **API Keys** | same |
