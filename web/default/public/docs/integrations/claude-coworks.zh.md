# Claude Cowork → DeepRouter

**Claude Cowork**（有时也写作 “Claude Coworks”）是 Anthropic 推出的桌面应用，用来配合 Claude
处理日常的知识工作 —— 而不只是写代码。较新的版本里包含一个
**第三方推理（Third-Party Inference）** 模式，让你可以把 Claude Cowork 的请求转发到一个外部网关，
而不是走 Anthropic 自己的云服务。DeepRouter 就可以当这个网关，因为它支持 Claude 的
**原生 Anthropic 格式**。

> **太长不看（TL;DR）** —— 打开开发者模式（Developer Mode），进入 **Configure Third-Party Inference → Gateway**，然后填入：
>
> | 字段 | 填什么 |
> |---|---|
> | Gateway base URL | `https://api.deeprouter.co` |
> | Gateway API key | 你的 DeepRouter 密钥（`sk-...`） |
> | Gateway auth scheme | `bearer` |

---

## 为什么选 DeepRouter

一把密钥，畅用所有模型 —— Claude、Qwen、GLM、DeepSeek、Kimi 等等 —— 自动路由，并且用量和花费都能在同一个地方看到。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter 的 **API Key**（以 `sk-` 开头）。在控制台的 **API Keys** 里能找到
   （注册后欢迎页上也会显示一次）。
3. 已安装 **Claude Cowork** 桌面应用。

> **实话实说：** 第三方推理是一个开发者模式下的功能，Anthropic 会不时调整它。
> 下面的菜单措辞对应的是较新的版本；如果你的版本叫法略有不同，
> 就找 “Developer Mode”（开发者模式）和 “Third-Party Inference / Gateway”（第三方推理 / 网关）。
> DeepRouter 这边要填的值是不变的。

---

## 操作步骤

1. 打开 Claude Cowork。
2. 启用开发者模式：**Help → Troubleshooting → Enable Developer Mode**。
3. 打开 **Developer** 菜单 → **Configure Third-Party Inference**。
4. 推理后端这里，选择 **Gateway**。
5. 填入：
   - **Gateway base URL**：`https://api.deeprouter.co`
     *（这里不要加 `/v1` —— DeepRouter 的 Anthropic 接口会自己补上 `/v1/messages`。）*
   - **Gateway API key**：你的 DeepRouter 密钥（`sk-...`）
   - **Gateway auth scheme**：`bearer`
6. 保存 / 应用，如果提示要重启就重启一下应用。

### 为什么不加 `/v1`

Claude Cowork 用的是 Anthropic 原生的 **Messages** 协议 —— 它发送的是
`POST /v1/messages`。DeepRouter 的 Anthropic 原生接入地址（Base URL）就是 **裸主机名**
`https://api.deeprouter.co`，它会替你补上 `/v1/messages`。你自己再加 `/v1` 就重复了。

### 选一个 Claude 模型

因为这条路径是 Anthropic 原生的，所以请选一个在你的 DeepRouter
**模型目录（Model Catalog）** 里存在的 **Claude** 模型（例如 `claude-haiku-4-5`）。
非 Claude 的模型不会通过 Anthropic Messages 格式提供。

---

## 验证是否生效

1. 在 Claude Cowork 里正常开一个对话，问点简单的，比如
   “Say hello from DeepRouter.”
2. 你应该会收到正常的回复。
3. 打开 DeepRouter 控制台 —— 这次请求应该会出现在你的用量 / 日志里。

---

## 常见问题排查

| 现象 | 怎么办 |
|---|---|
| **找不到这个设置** | 先启用 **开发者模式（Developer Mode）**（**Help → Troubleshooting**），再去 **Developer** 菜单里找。 |
| **连接错误 / 404** | Base URL 必须是 `https://api.deeprouter.co` —— **不要** 加 `/v1`，也不要带结尾斜杠。DeepRouter 会自己补上 `/v1/messages`。 |
| **401 / 鉴权错误** | 把 auth scheme 设为 **bearer**，并检查密钥是否正确、是否还有额度（**API Keys** + 账单）。 |
| **找不到模型** | 用控制台 **模型目录（Model Catalog）** 里的一个 **Claude** 模型 ID（这条 Anthropic 路径只提供 Claude 模型）。 |

---

## 参考

| 项目 | 值 |
|---|---|
| 在哪里设置 | Claude Cowork **Developer → Configure Third-Party Inference → Gateway** |
| Gateway base URL | `https://api.deeprouter.co`（不加 `/v1`） |
| 使用的接口 | `POST /v1/messages`（Anthropic 原生，自动补上） |
| 鉴权方式 | `Authorization: Bearer <key>`（scheme：`bearer`） |
| 模型 ID | DeepRouter 控制台 → **模型目录（Model Catalog）**（Claude 模型） |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
