# LangChain → DeepRouter

[LangChain](https://www.langchain.com) 是一个很受欢迎的框架，用来在大语言模型之上搭建应用。它的 `ChatOpenAI` 聊天模型可以对接任何兼容 OpenAI 的接口，所以你只要改一下 **接入地址（base URL）** 和 **API 密钥（API key）**，就能把它指向 DeepRouter——你原有的链路（chains）、智能体（agents）和工具（tools）都不用动。

> **一句话总结** —— 用 `ChatOpenAI`，配上 DeepRouter 兼容 OpenAI 的 base URL 即可。
>
> | SDK | 怎么设置 base URL | 密钥 |
> |---|---|---|
> | Python | `base_url="https://api.deeprouter.co/v1"` | `api_key="sk-..."` |
> | JS / TS | `configuration: { baseURL: "https://api.deeprouter.co/v1" }` | `apiKey: "sk-..."` |

---

## 为什么选 DeepRouter

一把密钥，畅享所有模型——Claude、Qwen、GLM、DeepSeek、Kimi 等等——自动路由，用量和花费都在同一个地方查看。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API 密钥**（`sk-...`），在控制台的 **API Keys** 里获取（注册后的欢迎页面上也会显示一次）。
3. 安装 LangChain 的 OpenAI 集成：
   - Python：`pip install langchain-openai`
   - JS/TS：`npm install @langchain/openai`

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

每一行的作用：
- `base_url` 把 LangChain 的 OpenAI 客户端重定向到 DeepRouter。
- `api_key` 是你的 DeepRouter 密钥（以 `Authorization: Bearer sk-...` 的形式发送）。
- `model` 是你在控制台 **Model Catalog（模型目录）** 里挑选的模型。

---

## JavaScript / TypeScript

在 JS SDK 里，base URL 要放进一个 **`configuration`** 对象（它会被原样透传给底层的 OpenAI 客户端），而 `apiKey` 和 `model` 则放在最外层：

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

## 另一种方式：ChatAnthropic（Claude 原生格式）

如果你特别想让 LangChain 使用 Claude 的 **原生** Messages 格式，而不是 OpenAI 格式，那就用 `ChatAnthropic`，并把它指向 DeepRouter 的裸主机地址（不带 `/v1`）：

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

对大多数 LangChain 应用来说，上面的 `ChatOpenAI` 方式更简单——只有在你需要 Claude 原生特性时，才用 `ChatAnthropic`。

---

## 验证是否生效

1. 运行上面的代码片段——你应该会收到一条回复。
2. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **鉴权 / 401 错误** | 检查密钥（`sk-...`），并确认它在控制台里还有额度（**API Keys** + 账单）。 |
| **连接 / 404 错误（ChatOpenAI）** | base URL 必须是 `https://api.deeprouter.co/v1`（带 `/v1`）。 |
| **连接 / 404 错误（ChatAnthropic）** | base URL 必须是 `https://api.deeprouter.co`（不带 `/v1`，结尾也不要带斜杠）。 |
| **JS 里 base URL 不起作用** | 在 JS 里它必须放进 `configuration: { baseURL: ... }`，而不是作为最外层的 `baseURL`。 |
| **找不到模型** | 使用控制台 **Model Catalog（模型目录）** 里完整准确的模型 ID（例如 `claude-haiku-4-5`）。 |
| **旧的 `openai_api_base` 不管用** | 较新版本的 `langchain-openai` 用的是 `base_url` / `api_key`。如果你的版本很旧，请升级该包。 |

---

## 速查表

| 项目 | Python (`ChatOpenAI`) | JS (`ChatOpenAI`) | Python (`ChatAnthropic`) |
|---|---|---|---|
| Base URL 参数 | `base_url` | `configuration.baseURL` | `base_url` |
| Base URL 取值 | `https://api.deeprouter.co/v1` | 同上 | `https://api.deeprouter.co` |
| 密钥参数 | `api_key` | `apiKey` | `api_key` |
| 接口端点 | `POST /chat/completions` | 同上 | `POST /v1/messages` |
| 模型 ID | 控制台 → **Model Catalog** | 同上 | 同上 |
| 获取密钥 | 控制台 → **API Keys** | 同上 | 同上 |
