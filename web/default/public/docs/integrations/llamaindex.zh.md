# LlamaIndex → DeepRouter

[LlamaIndex](https://www.llamaindex.ai) 是一个用来基于你自己的数据搭建搜索与问答应用（也就是 "RAG"）的框架。
它可以使用任何兼容 OpenAI 的 API 作为语言模型，
所以你只要改一下 **API 接入地址（Base URL）** 和 **API Key**，就能把它指向 DeepRouter。

对于非 OpenAI 的模型（比如通过 DeepRouter 转发的 Claude 或 Qwen），请使用
**`OpenAILike`** 模型——它和 LlamaIndex 的 `OpenAI` 类一样，只是没有那些
针对 OpenAI 自家模型名称的内置假设，所以你的自定义模型 ID 可以直接用。

> **一句话总结** —— 用 `OpenAILike`，配上 DeepRouter 兼容 OpenAI 的 Base URL。
>
> | 参数 | 值 |
> |---|---|
> | `api_base` | `https://api.deeprouter.co/v1` |
> | `api_key` | `sk-...` |
> | `model` | 控制台 **模型目录（Model Catalog）** 里的某个模型 ID |
> | `is_chat_model` | `True` |

---

## 为什么用 DeepRouter

一把密钥，畅用所有模型——Claude、Qwen、GLM、DeepSeek、Kimi 等等——自动路由，并且只在一个地方就能追踪用量和花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter **API Key**（`sk-...`），在控制台的 **API Keys** 里获取（注册后的欢迎页面上也会显示一次）。
3. 安装好 LlamaIndex 的 OpenAI-Like 集成：
   `pip install llama-index-llms-openai-like`

---

## 推荐做法：OpenAILike

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

每一行的作用：
- `api_base` 让 LlamaIndex 指向 DeepRouter 兼容 OpenAI 的接口。
  *（注意名字：LlamaIndex 用的是 `api_base`，不是 `base_url`。）*
- `api_key` 是你的 DeepRouter 密钥（会以 `Authorization: Bearer sk-...` 的形式发送）。
- `model` 是你在控制台 **模型目录（Model Catalog）** 里选的那个模型。
- `is_chat_model=True` 告诉 LlamaIndex 使用聊天接口
  （`/chat/completions`）。不加这个，`OpenAILike` 会默认走旧的 completion
  接口，而大多数聊天模型并不支持它——所以用 Claude/Qwen 等模型时记得设置它。

---

## 同样可行：普通的 OpenAI 类

如果你的模型 ID 恰好是 LlamaIndex 已经认识的那种，标准的 `OpenAI`
类也能用（`pip install llama-index-llms-openai`）：

```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    api_base="https://api.deeprouter.co/v1",
    api_key="sk-...",
    model="claude-haiku-4-5",
)
```

对于自定义/不常见的模型 ID，建议优先用 **`OpenAILike`**——它不会因为
认不出某个模型名就把它拒掉。

---

## 验证是否正常工作

1. 运行上面的代码片段——你应该会收到一条回复。
2. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **鉴权 / 401 错误** | 检查密钥（`sk-...`），以及它在控制台里是否还有额度（**API Keys** + 账单）。 |
| **连接 / 404 错误** | Base URL 必须是 `https://api.deeprouter.co/v1`（带 `/v1`），并且参数名是 `api_base`，不是 `base_url`。 |
| **回复为空 / 奇怪，或提示 "completion not supported"** | 加上 `is_chat_model=True`，让它走聊天接口。 |
| **模型被拒 / 提示 "unknown model"** | 改用 `OpenAILike`（而不是普通的 `OpenAI` 类），并使用 **模型目录（Model Catalog）** 里准确的模型 ID。 |

---

## 参考速查

| 项目 | 值 |
|---|---|
| 类 | `OpenAILike`（推荐）或 `OpenAI` |
| Base URL 参数 | `api_base` |
| Base URL 值 | `https://api.deeprouter.co/v1` |
| 密钥参数 | `api_key` |
| 聊天接口开关 | `is_chat_model=True` |
| 接口 | `POST /chat/completions` |
| 发送的鉴权头 | `Authorization: Bearer <key>` |
| 模型 ID | 控制台 → **模型目录（Model Catalog）** |
| 获取密钥 | 控制台 → **API Keys** |
