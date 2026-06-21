# LangChain → DeepRouter

[LangChain](https://www.langchain.com) is a popular framework for building apps on top
of language models. Its `ChatOpenAI` chat model talks to any OpenAI-compatible API, so
you can point it at DeepRouter just by changing the **base URL** and **API key** — the
rest of your chains, agents and tools stay the same.

> **TL;DR** — Use `ChatOpenAI` with DeepRouter's OpenAI-compatible base URL.
>
> | SDK | How to set the base URL | Key |
> |---|---|---|
> | Python | `base_url="https://api.deeprouter.co/v1"` | `api_key="sk-..."` |
> | JS / TS | `configuration: { baseURL: "https://api.deeprouter.co/v1" }` | `apiKey: "sk-..."` |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to track usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (`sk-...`) from the console under **API Keys** (also shown
   once on your welcome screen after signup).
3. LangChain's OpenAI integration installed:
   - Python: `pip install langchain-openai`
   - JS/TS: `npm install @langchain/openai`

---

## Python

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="https://api.deeprouter.co/v1",  # send requests to DeepRouter
    api_key="sk-...",                          # your DeepRouter key
    model="claude-haiku-4-5",                  # a model ID from the Model Catalog
)

print(llm.invoke("Say hello from DeepRouter.").content)
```

What each line does:
- `base_url` redirects LangChain's OpenAI client to DeepRouter.
- `api_key` is your DeepRouter key (sent as `Authorization: Bearer sk-...`).
- `model` is whichever model you picked from the console **Model Catalog**.

---

## JavaScript / TypeScript

In the JS SDK, the base URL goes inside a **`configuration`** object (it's passed
straight through to the underlying OpenAI client), while `apiKey` and `model` sit at the
top level:

```js
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  apiKey: "sk-...",            // your DeepRouter key
  model: "claude-haiku-4-5",  // a model ID from the Model Catalog
  configuration: {
    baseURL: "https://api.deeprouter.co/v1", // send requests to DeepRouter
  },
});

const res = await llm.invoke("Say hello from DeepRouter.");
console.log(res.content);
```

---

## Alternative: ChatAnthropic (native Claude format)

If you specifically want LangChain to speak Claude's **native** Messages format instead
of the OpenAI one, use `ChatAnthropic` and point it at DeepRouter's bare host (no `/v1`):

```python
# pip install langchain-anthropic
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    base_url="https://api.deeprouter.co",  # bare host — DeepRouter adds /v1/messages
    api_key="sk-...",                       # your DeepRouter key
    model="claude-haiku-4-5",
)

print(llm.invoke("Say hello from DeepRouter.").content)
```

For most LangChain apps the `ChatOpenAI` path above is simpler — use `ChatAnthropic`
only if you need Claude-native features.

---

## Verify it's working

1. Run the snippet above — you should get a reply.
2. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Auth / 401 error** | Check the key (`sk-...`) and that it has quota in the console (**API Keys** + billing). |
| **Connection / 404 error (ChatOpenAI)** | Base URL must be `https://api.deeprouter.co/v1` (with `/v1`). |
| **Connection / 404 error (ChatAnthropic)** | Base URL must be `https://api.deeprouter.co` (no `/v1`, no trailing slash). |
| **JS base URL ignored** | In JS it must go inside `configuration: { baseURL: ... }`, not as a top-level `baseURL`. |
| **Model not found** | Use an exact model ID from the console **Model Catalog** (e.g. `claude-haiku-4-5`). |
| **Old `openai_api_base` not working** | Newer `langchain-openai` uses `base_url` / `api_key`. Upgrade the package if you're on a very old version. |

---

## Reference

| Item | Python (`ChatOpenAI`) | JS (`ChatOpenAI`) | Python (`ChatAnthropic`) |
|---|---|---|---|
| Base URL param | `base_url` | `configuration.baseURL` | `base_url` |
| Base URL value | `https://api.deeprouter.co/v1` | same | `https://api.deeprouter.co` |
| Key param | `api_key` | `apiKey` | `api_key` |
| Endpoint | `POST /chat/completions` | same | `POST /v1/messages` |
| Model IDs | console → **Model Catalog** | same | same |
| Get a key | console → **API Keys** | same | same |
