# Zed → DeepRouter

[Zed](https://zed.dev) 是一款快速的代码编辑器，内置 AI 助手。Zed 允许你添加
自己的 **OpenAI 兼容**模型服务商，因此你可以把它的助手指向 DeepRouter。
做法是往 Zed 的 `settings.json` 里加一小段配置——Zed 有一个菜单项能帮你直接打开
这个文件，所以你不用费力去找它在哪。

> **一句话总结** — 在 Zed 的 `settings.json` 里添加一个 `openai_compatible` 服务商：
>
> | 字段 | 值 |
> |---|---|
> | `api_url` | `https://api.deeprouter.co/v1` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`）——在界面里输入，保存在你的系统钥匙串中 |
> | 模型 `name` | 来自控制台的 **Model Catalog**（模型目录），例如 `claude-haiku-4-5` |

---

## 为什么选 DeepRouter

一把密钥，畅享所有模型——Claude、Qwen、GLM、DeepSeek、Kimi 等等——智能路由，并在一处就能查看你的消费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API Key**（以 `sk-` 开头）。在控制台的 **API Keys** 里能找到
   （注册后在欢迎页面也会显示一次）。

---

## 操作步骤

1. 打开 Zed。打开命令面板（Mac 上是 **Cmd + Shift + P**，Windows/Linux 上是
   **Ctrl + Shift + P**），运行 **zed: open settings**，这会打开 `settings.json`。
2. 添加（或合并进）一段 `language_models` 配置，如下所示：

   ```json
   {
     "language_models": {
       "openai_compatible": {
         "DeepRouter": {
           "api_url": "https://api.deeprouter.co/v1",
           "available_models": [
             {
               "name": "claude-haiku-4-5",
               "display_name": "DeepRouter — Claude Haiku 4.5",
               "max_tokens": 200000
             }
           ]
         }
       }
     }
   }
   ```

   - `"DeepRouter"` 只是你在 Zed 里看到的标签——你可以随意命名。
   - 把 `"name"` 设为控制台 **Model Catalog**（模型目录）里真实存在的模型 ID。想用更多模型，
     就往 `available_models` 列表里多加几条。
3. 保存文件。
4. 现在添加你的**密钥**。打开 **Agent / Assistant** 面板，点击设置/齿轮图标，
   在列表里找到你的 **DeepRouter** 服务商，按提示粘贴你的 API Key（`sk-...`）。
   Zed 会把它安全地存进你系统的钥匙串里——它**不会**写进 `settings.json`。

> **提示：** Zed 也可以从一个环境变量里读取密钥，变量名按服务商 ID 拼出来，
> 即大写下划线形式 + `_API_KEY`。对于名为 `DeepRouter` 的服务商，就是 `DEEPROUTER_API_KEY`。
> 在启动 Zed 前设好这个变量，可以作为在界面里粘贴密钥的替代方案。

---

## 验证是否成功

1. 打开 Zed 的 **Agent / Assistant** 面板。
2. 在模型选择器里，选中你的 DeepRouter 模型（它会出现在你设置的服务商标签下面）。
3. 问一个简单的问题，比如 “Say hello from DeepRouter.”
4. 你应该会收到一条正常的回复，同时这次请求也会出现在你的 DeepRouter 控制台用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **服务商没出现** | 重新检查 `settings.json` 是否有 JSON 拼写错误（少了逗号或括号）。Zed 会在错误的 JSON 上显示红色波浪线。 |
| **认证 / 401 错误** | 确认你已经在 Agent 设置里粘贴了密钥（或设置了 `DEEPROUTER_API_KEY`），并且控制台里还有额度。 |
| **连接错误** | `api_url` 必须正好是 `https://api.deeprouter.co/v1`（要带 `/v1`，结尾不要加斜杠）。 |
| **找不到模型** | `name` 必须是控制台 **Model Catalog**（模型目录）里真实存在的 ID。 |
| **密钥没保存** | Zed 把密钥放在钥匙串里，而不是 `settings.json` 里——请通过 Agent 设置界面来设置它，而不是改文件。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 在哪里设置 | Zed `settings.json` → `language_models.openai_compatible` |
| `api_url` | `https://api.deeprouter.co/v1` |
| 使用的接口 | `POST /chat/completions`（OpenAI 兼容） |
| 认证方式 | `Authorization: Bearer <key>`（Zed 会帮你发送） |
| 密钥存储 | 系统钥匙串或 `DEEPROUTER_API_KEY` 环境变量——绝不在 `settings.json` 里 |
| 模型 ID | DeepRouter 控制台 → **Model Catalog**（模型目录） |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
