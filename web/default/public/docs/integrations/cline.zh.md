# Cline → DeepRouter

[Cline](https://cline.bot) 是一个运行在 VS Code 里的编程助手。它允许你自己选择模型供应商，因此你可以把它指向 DeepRouter。有两种接入方式，**两种都可以用** —— 选你喜欢的那种就行：

- **OpenAI Compatible** 方式（推荐，最简单）
- **Anthropic** 方式（如果你想让 Cline 使用 Anthropic 的原生格式）

> **一句话上手（OpenAI Compatible）** —— 在 Cline 的设置里，把供应商选为 **OpenAI Compatible**，然后填写：
>
> | 字段 | 值 |
> |---|---|
> | Base URL | `https://api.deeprouter.co/v1` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model ID | 在控制台 **Model Catalog**（模型目录）里查到（例如 `claude-haiku-4-5`） |

---

## 为什么用 DeepRouter

一把密钥，畅用全部模型 —— Claude、Qwen、GLM、DeepSeek、Kimi 等等 —— 自动路由，用量和花费都在同一个地方查看。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API key**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到（注册后的欢迎页面也会显示一次）。
3. 在 VS Code 里安装好 **Cline** 扩展（从扩展商店安装）。

---

## 方式 A —— OpenAI Compatible（推荐）

1. 在 VS Code 里打开 Cline（点击侧边栏的机器人图标）。
2. 点击 Cline 面板顶部的 **齿轮 / 设置（⚙️）** 图标。
3. 在 **API Provider**（API 供应商）下，打开下拉菜单，选择 **OpenAI Compatible**。
4. 填写这三个字段：
   - **Base URL**：`https://api.deeprouter.co/v1`
   - **API Key**：你的 DeepRouter 密钥（`sk-...`）
   - **Model ID**：从控制台 **Model Catalog**（模型目录）里选一个模型，例如 `claude-haiku-4-5`
5. 点击 **Done / Save**（完成 / 保存）。

搞定 —— Cline 现在会通过 OpenAI 风格的 `/chat/completions` 接口，把你的对话发送给 DeepRouter。

---

## 方式 B —— Anthropic（原生）

如果你更希望 Cline 用 Anthropic 的原生 Messages 格式跟 DeepRouter 通信，就用这种方式。

1. 打开 Cline → **设置（⚙️）** 图标。
2. 在 **API Provider** 下，选择 **Anthropic**。
3. 勾选 **Use custom base URL**（使用自定义 base URL），并在 URL 框里输入：
   ```
   https://api.deeprouter.co
   ```
   *（这里不要加 `/v1` —— Anthropic 方式用的是纯主机地址；DeepRouter 会自己补上 `/v1/messages`。）*
4. 在 **Anthropic API Key** 字段里，粘贴你的 DeepRouter 密钥（`sk-...`）。
5. 从 **Model** 下拉菜单里，选一个在你 DeepRouter 目录里的 Claude 模型（例如 `claude-haiku-4-5`）。除非你需要，否则可以让 **Enable Extended Thinking**（启用扩展思考）保持关闭。
6. 点击 **Done / Save**（完成 / 保存）。

---

## 验证是否正常工作

1. 在 Cline 的聊天框里，输入一个简单请求，比如 “Say hello from DeepRouter”，然后发送。
2. 你应该会收到一条正常的回复。
3. 打开 DeepRouter 控制台 —— 这次请求应该会出现在你的用量 / 日志里。

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **鉴权 / 401 错误** | 检查密钥是否正确、控制台里是否还有额度（**API Keys** + 账单）。 |
| **连接错误（OpenAI Compatible）** | Base URL 必须是 `https://api.deeprouter.co/v1`（要带 `/v1`）。 |
| **连接错误（Anthropic）** | Base URL 必须是 `https://api.deeprouter.co`（不带 `/v1`，结尾也不带斜杠）。 |
| **找不到模型** | 使用控制台 **Model Catalog**（模型目录）里完整准确的 model ID。 |
| **设置保存不了** | 重新打开 ⚙️ 面板，重新填写字段；并确认先选对了 **API Provider**。 |

---

## 速查表

| 项目 | OpenAI Compatible | Anthropic |
|---|---|---|
| 要选的供应商 | **OpenAI Compatible** | **Anthropic** |
| Base URL | `https://api.deeprouter.co/v1` | `https://api.deeprouter.co` |
| 使用的接口 | `POST /chat/completions` | `POST /v1/messages`（自动补全） |
| 鉴权方式 | `Authorization: Bearer <key>` | `x-api-key: <key>` |
| Model ID | DeepRouter 控制台 → **Model Catalog** | 同上 |
| 获取密钥 | DeepRouter 控制台 → **API Keys** | 同上 |
