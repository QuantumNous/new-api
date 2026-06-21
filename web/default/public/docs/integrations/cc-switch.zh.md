# CC Switch → DeepRouter

[CC Switch](https://github.com/farion1231/cc-switch) 是一个小巧免费的桌面应用
（带图形界面），它能帮你把多个 Claude Code 的"服务商"集中管理起来，一键切换。
你不用再手动去改配置文件，只需填一次表单、按一下按钮，CC Switch 就会替你把正确的
设置写进 `~/.claude/settings.json`。本指南教你把 **DeepRouter** 添加为其中一个服务商。

> **一句话版** — 在 CC Switch 里点 **Add（添加）**，然后填入：
>
> | 字段 | 填什么 |
> |---|---|
> | 服务商名称（Name） | `deeprouter` |
> | 网站（Website Link） | `https://deeprouter.co` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | 请求地址（Endpoint URL / base_url） | `https://api.deeprouter.co` *（结尾不要带斜杠）* |
> | API 格式 | **Anthropic Messages (Native)** |
> | 鉴权字段（Auth field） | `ANTHROPIC_AUTH_TOKEN` |
> | 模型配置 | 留空 |
>
> 保存后，在 DeepRouter 卡片上点 **Use（使用）**（新版本里这个按钮叫 **Enable（启用）**）。

---

## 为什么用 DeepRouter

一把密钥，畅享所有模型 —— Claude、Qwen、GLM、DeepSeek、Kimi 等等 —— 自动路由，
用量和花费都在一个地方查看。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API 密钥**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到
   （注册成功后的欢迎页上也会显示一次）。
3. 装好 **CC Switch**（从[发布页](https://github.com/farion1231/cc-switch/releases)下载）。
4. 已经装好 **Claude Code** —— CC Switch 只负责管理 Claude Code *用哪个*服务商。

---

## 把 DeepRouter 添加为服务商

1. 打开 **CC Switch**。
2. 点 **Add（添加）**（新建服务商的按钮）。
3. 填写表单：
   - **服务商名称（Provider Name）**：`deeprouter` —— 这只是个标签，方便你以后认出它。
   - **网站（Website）**：`https://deeprouter.co` —— 可选，只是卡片上一个方便点击的链接。
   - **API Key**：粘贴你的 DeepRouter 密钥（`sk-...`）。
   - **请求地址（Request URL）**（你的版本里可能叫 **Endpoint URL** 或 **base_url**）：
     `https://api.deeprouter.co`
     *（只填这个纯地址 —— **不要**加 `/v1`，**不要**在结尾加斜杠。当 DeepRouter 使用
     Anthropic 格式对话时，会自己补上 `/v1/messages`。）*
   - **API 格式（API Format）**：选 **Anthropic Messages (Native)**。这是告诉 CC Switch
     用 Claude 自己的消息格式来跟 DeepRouter 对话 —— 也就是 Claude Code 默认用的那种格式。
   - **鉴权字段（Auth field）**：选 **`ANTHROPIC_AUTH_TOKEN`**（不是 `ANTHROPIC_API_KEY`）。
     这是 Claude Code 用来读取你密钥的那个环境变量。
   - **模型配置（Model config）**：**留空。** 留空时，Claude Code 会用它平常的默认模型，
     由 DeepRouter 替你路由。只有当你想固定使用某个特定模型时，才需要在这里填模型。
4. 点 **Save（保存）** / **Add（添加）** 把这个服务商存下来。

---

## 切换到 DeepRouter

在服务商列表里，找到 **deeprouter** 卡片，点 **Use（使用）**
（新版 CC Switch 里这个按钮叫 **Enable（启用）**）。

这一下点击，就会重写你的 `~/.claude/settings.json`，让 Claude Code 改为指向
DeepRouter。你不用手动改任何文件 —— CC Switch 都替你做好了。

> 如果 Claude Code 已经在运行，请重启它（关掉再打开，或开一个新会话），
> 好让它读到新设置。

---

## 验证是否生效

1. 打开终端，在任意项目里启动 Claude Code（`claude`）。
2. 随便问它点什么，比如 *"Say hello from DeepRouter."*，应该能收到正常回复。
3. 打开 DeepRouter 控制台 —— 这次请求应该会出现在你的用量/日志里。

你也可以看一眼 CC Switch 写好的那个文件：

```bash
cat ~/.claude/settings.json
```

你应该能看到一个 `env` 区块，里面 `ANTHROPIC_BASE_URL` 被设为
`https://api.deeprouter.co`，`ANTHROPIC_AUTH_TOKEN` 被设为你的密钥。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **鉴权失败 / 401 错误** | 重新检查密钥（`sk-...`），并确认它在控制台里还有额度（**API Keys** + 账单）。确认你用的鉴权字段是 **`ANTHROPIC_AUTH_TOKEN`**，而不是 `ANTHROPIC_API_KEY`。 |
| **连接错误 / 404** | 请求地址必须正好是 `https://api.deeprouter.co` —— 不要加 `/v1`，不要带结尾斜杠。也不要开启 "Full URL Mode"。 |
| **Claude Code 没有应用改动** | 点完 **Use** / **Enable** 后重启 Claude Code，好让它重新读取 `~/.claude/settings.json`。 |
| **找不到模型（Model not found）** | 把模型配置留空，或者填一个控制台 **Model Catalog（模型目录）** 里确切的模型 ID（例如 `claude-haiku-4-5`）。 |
| **格式错误（Wrong format）** | 确认 **API 格式** 选的是 **Anthropic Messages (Native)**，而不是 OpenAI Chat Completions。 |

---

## 参考速查

| 项目 | 值 |
|---|---|
| 服务商名称 | `deeprouter` |
| 请求地址（base_url） | `https://api.deeprouter.co`（不带 `/v1`，不带结尾斜杠） |
| 实际使用的端点 | `POST /v1/messages`（由 DeepRouter 自动补上） |
| API 格式 | Anthropic Messages (Native) |
| 鉴权字段 | `ANTHROPIC_AUTH_TOKEN`（→ `Authorization: Bearer <key>`） |
| 写入的文件 | `~/.claude/settings.json` |
| 模型 ID | DeepRouter 控制台 → **Model Catalog（模型目录）** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
