# LlamaIndex → DeepRouter

[LlamaIndex](https://www.llamaindex.ai) is a framework for building search and Q&A apps
over your own data ("RAG"). It can use any OpenAI-compatible API as its language model,
so you can point it at DeepRouter by changing the **API base URL** and **API key**.

For non-OpenAI models (like Claude or Qwen routed through DeepRouter), use the
**`OpenAILike`** model — it's the same as LlamaIndex's `OpenAI` class but without the
built-in assumptions about OpenAI's own model names, so your custom model IDs just work.

> **TL;DR** — Use `OpenAILike` with DeepRouter's OpenAI-compatible base URL.
>
> | Param | Value |
> |---|---|
> | `api_base` | `https://api.deeprouter.co/v1` |
> | `api_key` | `sk-...` |
> | `model` | a model ID from the console **Model Catalog** |
> | `is_chat_model` | `True` |

---

## Why DeepRouter

One key, every model — Claude, Qwen, GLM, DeepSeek, Kimi and more — with automatic routing and a single place to track usage and spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (`sk-...`) from the console under **API Keys** (also shown
   once on your welcome screen after signup).
3. The LlamaIndex OpenAI-Like integration installed:
   `pip install llama-index-llms-openai-like`

---

## Recommended: OpenAILike

```python
from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    api_base="https://api.deeprouter.co/v1",  # send requests to DeepRouter
    api_key="sk-...",                          # your DeepRouter key
    model="claude-haiku-4-5",                  # a model ID from the Model Catalog
    is_chat_model=True,                        # use the /chat/completions endpoint
)

print(llm.complete("Say hello from DeepRouter."))
```

What each line does:
- `api_base` points LlamaIndex at DeepRouter's OpenAI-compatible endpoint.
  *(Note the name: LlamaIndex uses `api_base`, not `base_url`.)*
- `api_key` is your DeepRouter key (sent as `Authorization: Bearer sk-...`).
- `model` is whichever model you picked from the console **Model Catalog**.
- `is_chat_model=True` tells LlamaIndex to use the chat endpoint
  (`/chat/completions`). Without it, `OpenAILike` defaults to the older completion
  endpoint, which most chat models don't support — so set this for Claude/Qwen/etc.

---

## Also works: the plain OpenAI class

If your model ID happens to be one LlamaIndex already recognises, the standard `OpenAI`
class works too (`pip install llama-index-llms-openai`):

```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    api_base="https://api.deeprouter.co/v1",
    api_key="sk-...",
    model="claude-haiku-4-5",
)
```

For custom/unfamiliar model IDs, prefer **`OpenAILike`** — it won't reject a model name
it doesn't know about.

---

## Verify it's working

1. Run the snippet above — you should get a reply.
2. Open the DeepRouter console — the request should appear in your usage/logs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Auth / 401 error** | Check the key (`sk-...`) and that it has quota in the console (**API Keys** + billing). |
| **Connection / 404 error** | The base must be `https://api.deeprouter.co/v1` (with `/v1`) and the param is `api_base`, not `base_url`. |
| **Empty / odd replies, or "completion not supported"** | Add `is_chat_model=True` so the chat endpoint is used. |
| **Model rejected / "unknown model"** | Use `OpenAILike` (not the plain `OpenAI` class) and an exact model ID from the **Model Catalog**. |

---

## Reference

| Item | Value |
|---|---|
| Class | `OpenAILike` (recommended) or `OpenAI` |
| Base URL param | `api_base` |
| Base URL value | `https://api.deeprouter.co/v1` |
| Key param | `api_key` |
| Chat endpoint flag | `is_chat_model=True` |
| Endpoint | `POST /chat/completions` |
| Auth header sent | `Authorization: Bearer <key>` |
| Model IDs | console → **Model Catalog** |
| Get a key | console → **API Keys** |
