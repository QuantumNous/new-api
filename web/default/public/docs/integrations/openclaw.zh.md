# OpenClaw → DeepRouter

[OpenClaw](https://openclaw.ai) 是一款由配置文件驱动的 AI 编程／智能体工具。你只需在一个小小的 JSON 文件（`openclaw.json`）里、或者用两个环境变量，告诉它你的模型服务商信息，它就能指向任何 **OpenAI 兼容**或 **Anthropic 兼容**的服务。DeepRouter 两者都支持，所以 OpenClaw 用哪种方式都行。

这次需要改动一个小文件（或者设置两个环境变量），但仍然是复制粘贴就能搞定，不用写代码。

> **太长不看（OpenAI 兼容，最简单）** — 在 `openclaw.json` 里加一个服务商：
>
> | 设置项 | 值 |
> |---|---|
> | `baseUrl` | `https://api.deeprouter.co/v1` |
> | `apiKey` | 你的 DeepRouter 密钥（`sk-...`） |
> | model | 从控制台的 **模型目录（Model Catalog）** 里选（例如 `claude-haiku-4-5`） |

---

## 为什么用 DeepRouter

一个密钥，畅用所有模型 —— Claude、Qwen、GLM、DeepSeek、Kimi 等等 —— 自动路由，还能在一个地方统一查看你的用量和花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter **API Key**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到（注册后的欢迎页上也会展示一次）。
3. 已经安装好 **OpenClaw**。

> **实话提醒：** OpenClaw 是配置驱动的，更新很快。下面的写法对应的是较新的版本，每个模型都用 `provider/model-id` 的形式引用。如果你的版本里键名略有不同，思路是一样的：一个带 **base URL** + **API Key** 的服务商，再加一个名为 `deeprouter/<model>` 的模型。如果某个键名对不上，查一下 OpenClaw 自己的文档。

---

## 方案 A —— 配置文件（推荐）

1. 用任意文本编辑器打开你的 **`openclaw.json`** 配置文件。
2. 加一个 DeepRouter 服务商，并把默认模型指向它：

   ```json5
   {
     "models": {
       "providers": {
         "deeprouter": {
           "baseUrl": "https://api.deeprouter.co/v1",
           "apiKey": "sk-your-deeprouter-key"
         }
       },
       "agents": {
         "defaults": {
           "model": "deeprouter/claude-haiku-4-5"
         }
       }
     }
   }
   ```

3. 把 `sk-your-deeprouter-key` 换成你真实的密钥，把 `claude-haiku-4-5` 换成 DeepRouter 控制台 **模型目录（Model Catalog）** 里的任意一个模型 ID。
4. 保存文件。

这就是 **OpenAI 兼容** 的方式 —— 注意 base URL 末尾的 `/v1`。

### 更想用 Claude 原生（Anthropic）格式？

如果你更希望 OpenClaw 用 Anthropic 原生的 Messages 格式与 DeepRouter 通信，就把服务商的协议／`api` 类型设为 `anthropic`，并使用**纯主机地址**（不带 `/v1` —— DeepRouter 会自己补上 `/v1/messages`）：

```json5
"deeprouter": {
  "api": "anthropic",
  "baseUrl": "https://api.deeprouter.co",
  "apiKey": "sk-your-deeprouter-key"
}
```

走这种方式时，请把模型指向目录里的某个 **Claude** 模型（例如 `deeprouter/claude-haiku-4-5`）。

---

## 方案 B —— 环境变量（不用改文件）

OpenClaw 支持标准的环境变量覆盖。根据你想用的协议设置对应的那一对变量，然后重启 OpenClaw：

**OpenAI 兼容：**
```bash
export OPENAI_BASE_URL="https://api.deeprouter.co/v1"
export OPENAI_API_KEY="sk-your-deeprouter-key"
```

**Anthropic 原生：**
```bash
export ANTHROPIC_BASE_URL="https://api.deeprouter.co"
export ANTHROPIC_AUTH_TOKEN="sk-your-deeprouter-key"
```

（在 Windows 上，请用 `setx NAME "value"`，然后重新打开终端。）

---

## 验证是否生效

1. 运行一个简单的 OpenClaw 命令，例如列出模型，或者发一句话的提示词，比如 “Say hello from DeepRouter.”
2. 你应该会收到一条正常的回复。
3. 打开 DeepRouter 控制台 —— 这次请求应该会出现在你的用量／日志里。

---

## 疑难排查

| 现象 | 解决办法 |
|---|---|
| **连接错误 / 404（OpenAI 方式）** | Base URL 必须是 `https://api.deeprouter.co/v1`（要带 `/v1`）。 |
| **连接错误 / 404（Anthropic 方式）** | Base URL 必须是 `https://api.deeprouter.co`（不带 `/v1`，结尾也不要带斜杠）。 |
| **401 / 鉴权错误** | 密钥错误、被吊销，或额度用完了 —— 到控制台检查 **API Keys** 和账单。 |
| **找不到模型** | 使用 **模型目录（Model Catalog）** 里准确的模型 ID，并以 `deeprouter/<model-id>` 的形式引用。走 Anthropic 方式时，请用 Claude 模型。 |
| **JSON 加载失败** | 检查 `openclaw.json` 里是不是多了个逗号或少了个引号。用标准 JSON 最稳妥。 |

---

## 参考信息

| 项目 | OpenAI 兼容 | Anthropic 原生 |
|---|---|---|
| Base URL | `https://api.deeprouter.co/v1` | `https://api.deeprouter.co` |
| 使用的端点 | `POST /chat/completions` | `POST /v1/messages`（自动补全） |
| 鉴权 | `Authorization: Bearer <key>` | `x-api-key` / Bearer token |
| 环境变量 | `OPENAI_BASE_URL` + `OPENAI_API_KEY` | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` |
| 模型引用 | `deeprouter/<model-id>` | `deeprouter/<claude-model-id>` |
| 模型 ID | DeepRouter 控制台 → **模型目录（Model Catalog）** | 同上 |
| 获取密钥 | DeepRouter 控制台 → **API Keys** | 同上 |
