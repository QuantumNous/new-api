# OpenAI SDK → DeepRouter

官方 **OpenAI SDK**（Python 版和 Node/TypeScript 版）是大家从代码里调用 OpenAI 的标准方式。
DeepRouter 兼容同一套 OpenAI 接口，所以你不需要换库——只要把 SDK 指向 DeepRouter，
改两样东西即可：**接入地址（Base URL）** 和 **API Key**。你现有的代码继续照常工作。

> **一句话总结** — 把接入地址（Base URL）设为 `https://api.deeprouter.co/v1`，并使用你的
> DeepRouter 密钥（`sk-...`）。
>
> | SDK | Base URL 参数 | 密钥参数 |
> |---|---|---|
> | Python | `base_url="https://api.deeprouter.co/v1"` | `api_key="sk-..."` |
> | Node / TS | `baseURL: "https://api.deeprouter.co/v1"` | `apiKey: "sk-..."` |
>
> 或者干脆不改代码，直接设置环境变量：`OPENAI_BASE_URL=https://api.deeprouter.co/v1` 和
> `OPENAI_API_KEY=sk-...`。

---

## 为什么选 DeepRouter

一把密钥，畅用所有模型——Claude、Qwen、GLM、DeepSeek、Kimi 等等——自动路由，用量和花费也都集中在一处查看。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API Key**（`sk-...`），在控制台 **API Keys** 里获取（注册后的欢迎页面也会显示一次）。
3. 安装好官方 OpenAI SDK：
   - Python：`pip install openai`
   - Node：`npm install openai`

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

每一行的作用：
- `base_url` 告诉 SDK 把请求发到 DeepRouter 的 OpenAI 兼容接口。
- `api_key` 是你的 DeepRouter 密钥——它会以 `Authorization: Bearer sk-...` 的形式发送。
- `model` 是你在控制台 **Model Catalog**（模型目录）里选的那个模型。

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

注意拼写和 Python 不一样：Node 用的是 **`baseURL`** 和 **`apiKey`**（驼峰写法），
Python 用的是 **`base_url`** 和 **`api_key`**（下划线写法）。

---

## 或者直接用环境变量（不用改代码）

两个 SDK 都会自动读取这些环境变量，所以你可以原封不动地保留代码，只设置环境：

```bash
export OPENAI_BASE_URL="https://api.deeprouter.co/v1"
export OPENAI_API_KEY="sk-..."
```

这样不带任何参数地调用 `OpenAI()`（Python）或 `new OpenAI()`（Node），就已经指向 DeepRouter 了。
当你不想把密钥写进源代码里时，这个办法很方便。

---

## 验证是否生效

1. 运行上面的代码片段（或在设置好环境变量后跑一行小命令），你应该会收到回复。
2. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

命令行快速冒烟测试（无需 SDK）：

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

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **鉴权 / 401 错误** | 检查密钥（`sk-...`），并确认它在控制台里还有额度（**API Keys** + 账单）。如果用的是环境变量，确保 `OPENAI_API_KEY` 已在同一个终端里 export。 |
| **连接 / 404 错误** | Base URL 必须是 `https://api.deeprouter.co/v1`（要带 `/v1`）。 |
| **找不到模型** | 使用控制台 **Model Catalog**（模型目录）里准确的模型 ID（例如 `claude-haiku-4-5`）。 |
| **还是在请求 api.openai.com** | 可能是某个残留的 `OPENAI_BASE_URL`（或别处硬编码的 Base URL）覆盖了你的设置。把你实际传入的值打印出来看看。 |
| **`base_url` 和 `baseURL` 报错** | Python = `base_url` / `api_key`；Node = `baseURL` / `apiKey`。别混用。 |

---

## 参考速查

| 项目 | Python | Node / TS |
|---|---|---|
| Base URL 参数 | `base_url` | `baseURL` |
| 密钥参数 | `api_key` | `apiKey` |
| Base URL 取值 | `https://api.deeprouter.co/v1` | 同上 |
| 接口端点 | `POST /chat/completions` | 同上 |
| 环境变量 | `OPENAI_BASE_URL`、`OPENAI_API_KEY` | 同上 |
| 发送的鉴权头 | `Authorization: Bearer <key>` | 同上 |
| 模型 ID | 控制台 → **Model Catalog** | 同上 |
| 获取密钥 | 控制台 → **API Keys** | 同上 |
