# GitHub Copilot → DeepRouter

简短版本：**是的，现在可以做到了——但只能用一种特定的方式，而且只支持聊天。**

**VS Code** 里的 GitHub Copilot 新增了一个叫 **Bring Your Own Key（BYOK，自带密钥）** 的功能。它允许
你接入一个**兼容 OpenAI** 的服务端点——DeepRouter 正是这样的端点——然后在 Copilot 的
**Chat（聊天）**（包括 agent 模式）里使用这些模型。我们先把它的限制讲清楚，免得你后面意外踩坑：

- ✅ 适用于 **Copilot Chat** 和 **agent / 自定义 agent**。
- ❌ **不**适用于**行内代码补全**（也就是那种灰色的“幽灵文字”）。这部分仍然只能用
  GitHub 自己的模型——BYOK 改不了它。这是 Copilot 的限制，不是 DeepRouter 的限制。
- ℹ️ BYOK 最先在 **VS Code Insiders** 上线，并在 2026 年期间逐步进入稳定版。如果你
  看不到下面提到的选项，请更新 VS Code（或者改用 Insiders 版本）。

> **一句话总结** —— 在 VS Code 里运行 **Chat: Manage Language Models**，添加一个 **OpenAI Compatible** 提供方：
>
> | 字段 | 值 |
> |---|---|
> | Base URL / 端点 | `https://api.deeprouter.co/v1` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model ID | 来自控制台的 **Model Catalog（模型目录）**（例如 `claude-haiku-4-5`） |

---

## 为什么选 DeepRouter

一个密钥就能让 Copilot Chat 用上我们目录里的所有模型（Claude、Qwen、GLM、DeepSeek 等等），还带智能路由，并且在一个地方就能看清你的花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter 的 **API key**（以 `sk-` 开头），在控制台的 **API Keys** 里获取
   （注册后的欢迎页面上也会显示一次）。
3. 已登录 **GitHub Copilot** 的 **VS Code**。BYOK 在个人版 Copilot
   套餐（Free、Pro、Pro+）上可用；部分由组织管理的账号可能被管理员策略限制。
4. 一个比较新的 VS Code 版本。如果下面的步骤对不上，就更新一下——或者安装 **VS Code Insiders**。

---

## 操作步骤

1. 在 VS Code 里打开 **命令面板（Command Palette）**（**Cmd + Shift + P** / **Ctrl + Shift + P**）。
2. 运行命令 **Chat: Manage Language Models**（在 Copilot Chat 的模型选择器里有时也显示为
   “Manage Models”）。
3. 当要求你选择提供方时，选 **OpenAI Compatible**。
4. 按提示填写连接信息：
   - **Base URL / 端点**：`https://api.deeprouter.co/v1`
   - **API Key**：你的 DeepRouter 密钥（`sk-...`）
5. 填写或确认你想用的 **Model ID**——用 DeepRouter 控制台
   **Model Catalog（模型目录）** 里的一个，例如 `claude-haiku-4-5`。勾选它以启用。
6. 完成。你的 DeepRouter 模型现在会出现在 **Copilot Chat 的模型下拉菜单**里。

> 进阶用户提示：VS Code 还提供一个叫 `github.copilot.chat.customOAIModels`
> 的设置，可以用来微调模型能力。基础配置用不到它——上面的选择器就够了。

---

## 验证是否生效

1. 打开 **Copilot Chat**（侧边栏里的聊天图标）。
2. 在聊天框底部打开**模型下拉菜单**，选中你的 DeepRouter 模型。
3. 问一个简单的问题，比如 “Say hello from DeepRouter.”
4. 你应该会收到正常的回复——而且这条请求会出现在你 DeepRouter 控制台的用量/日志里。
   （注意：用量走的是你的 DeepRouter 账号/账单，而不是你的 Copilot 请求额度。）

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **没有 “Manage Language Models” / “OpenAI Compatible” 选项** | 你的 VS Code/Copilot 版本太旧，或者组织策略禁用了 BYOK。更新 VS Code（或用 Insiders）；如果是被管理的账号，找管理员确认。 |
| **认证 / 401 错误** | 确认密钥正确，并且控制台里有余额（**API Keys** + 账单）。 |
| **连接错误** | Base URL 必须正好是 `https://api.deeprouter.co/v1`（带 `/v1`，结尾不要加斜杠）。 |
| **找不到模型（Model not found）** | 使用控制台 **Model Catalog（模型目录）** 里的准确模型 ID。 |
| **代码补全仍然用的是 GitHub 的模型** | 这是正常现象——BYOK 只覆盖 **Chat / agent**，永远不会覆盖行内补全。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 在哪里设置 | VS Code → **Chat: Manage Language Models** → **OpenAI Compatible** |
| 适用范围 | 仅 Copilot **Chat / agent**（不含行内补全） |
| Base URL | `https://api.deeprouter.co/v1` |
| 使用的端点 | `POST /chat/completions`（兼容 OpenAI） |
| 认证 | `Authorization: Bearer <key>`（VS Code 会替你发送） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog（模型目录）** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
