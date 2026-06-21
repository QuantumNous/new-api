# NextChat (ChatGPT-Next-Web) → DeepRouter

[NextChat](https://github.com/ChatGPTNextWeb/NextChat)（原名 ChatGPT-Next-Web）是一款
轻量的聊天应用，你可以在浏览器、手机上使用，也可以部署在自己的服务器上。
它本身就是为对接 OpenAI 风格的服务而设计的，所以接入 DeepRouter 只需要填一个
自定义接入地址和你的密钥。用现成的应用完全不用写代码——如果你自己部署，也只是两个环境变量的事。

> **太长不看（在应用内）** — 打开 **设置（Settings）**，滚动到模型/接入相关的部分，填入：
>
> | 字段 | 值 |
> |---|---|
> | API Endpoint（自定义接入地址） | `https://api.deeprouter.co` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model（模型） | 从控制台 **模型目录（Model Catalog）** 里添加一个（例如 `claude-haiku-4-5`） |
>
> **太长不看（自部署）** — 设置环境变量 `BASE_URL=https://api.deeprouter.co` 和
> `OPENAI_API_KEY=sk-...`

---

## 为什么选 DeepRouter

一个密钥就能让 NextChat 用上我们目录里的所有模型（Claude、Qwen、GLM、DeepSeek、Kimi 等等），还自带智能路由，并在同一个地方查看你的花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter **API key**（以 `sk-` 开头）。在控制台的 **API Keys** 里能找到——
   注册后欢迎页上也会一次性展示给你。

---

## 方案 A — 在应用里（无需配置）

如果你打开的是别人托管好的 NextChat 或桌面版应用，就用这个方案。

1. 打开 NextChat，点击齿轮图标进入 **设置（Settings）**。
2. 向下滚动，找到包含 **API Endpoint**（有时显示为 **Custom Endpoint**
   或 **接口地址**）和 **API Key** 的部分。
3. 在 **API Endpoint** 里粘贴：
   ```
   https://api.deeprouter.co
   ```
   NextChat 会自己补上 `/v1/chat/completions` 这一段——所以这里只填**主机地址**，
   不要带 `/v1`。
4. 在 **API Key** 里粘贴你的 DeepRouter 密钥（`sk-...`）。
5. 找到 **Custom Models**（或 **Model**），从 DeepRouter 控制台的
   **模型目录（Model Catalog）** 里取一个 ID 添加进去，格式为 `+claude-haiku-4-5@OpenAI`。
   然后把它选为当前使用的模型。

---

## 方案 B — 自部署（Docker / Vercel）

如果你要自己部署 NextChat，就用这个方案。设置下面这两个环境变量：

```bash
BASE_URL=https://api.deeprouter.co
OPENAI_API_KEY=sk-your-deeprouter-key
```

Docker 示例：

```bash
docker run -d -p 3000:3000 \
  -e BASE_URL=https://api.deeprouter.co \
  -e OPENAI_API_KEY=sk-your-deeprouter-key \
  yidadaa/chatgpt-next-web
```

如果想暴露指定的几个模型，再设置 `CUSTOM_MODELS`，例如
`CUSTOM_MODELS=+claude-haiku-4-5@OpenAI`。

> NextChat 具体的环境变量名和设置项标签会随版本和部署方式不同而变化——如果
> `BASE_URL` 不生效，请查看你所用版本的 README，确认它实际读取的是哪个
> base-URL 变量。

---

## 验证是否正常

1. 新开一个对话，选中你的 DeepRouter 模型。
2. 随便问点简单的，比如 “Say hello from DeepRouter.”
3. 你应该会收到正常的回复。然后打开 DeepRouter 控制台——这次请求应该
   会出现在你的用量/日志里。

---

## 故障排查

| 现象 | 解决办法 |
|---|---|
| **404 / “not found”** | 你大概在接入地址里加了 `/v1`。NextChat 会自己补上——只填主机地址：`https://api.deeprouter.co`。 |
| **找不到模型 / 没有回复** | 通过 **Custom Models** 添加模型，格式为 `+<model-id>@OpenAI`，其中的 ID 取自 **模型目录（Model Catalog）**，添加后选中它。 |
| **自部署的改动没生效** | 环境变量需要重启/重新部署后才会生效；确认变量名和你所用版本的 README 一致。 |
| **401 / 鉴权错误** | 密钥不对、已被吊销，或额度用尽——到控制台检查 **API Keys** 和账单。 |
| **回复看起来还是 OpenAI 的** | 自定义接入地址/密钥没保存上，或选中了内置模型——重新检查设置。 |

---

## 参考速查

| 项目 | 值 |
|---|---|
| 在哪里设置（应用） | NextChat **设置 → API Endpoint + API Key** |
| 在哪里设置（自部署） | 环境变量 `BASE_URL` + `OPENAI_API_KEY` |
| Base URL / 接入地址 | `https://api.deeprouter.co`（只填主机地址——NextChat 会补上 `/v1/chat/completions`） |
| 使用的接口 | `POST /v1/chat/completions`（兼容 OpenAI） |
| 鉴权 | `Authorization: Bearer <key>`（NextChat 会替你发送密钥） |
| 自定义模型格式 | `+<model-id>@OpenAI`（例如 `+claude-haiku-4-5@OpenAI`） |
| 模型 ID | DeepRouter 控制台 → **模型目录（Model Catalog）** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
