# WorkBuddy → DeepRouter

**WorkBuddy**（腾讯出品的 AI 助手，CodeBuddy 的国际版）允许你添加指向任意
OpenAI 兼容服务的自定义模型。DeepRouter 正是这样一种服务，所以你只要用我们的接入地址和你的
密钥添加一个自定义模型，就能让 WorkBuddy 通过 DeepRouter 来调用。

> ⚠️ **如实说明：** WorkBuddy 的设置界面和配置字段名在不同版本、不同平台之间会有变化。
> 下面的步骤对应的是 WorkBuddy 目前所记录的自定义模型方式（一个 `models.json` 配置文件）。
> 如果你的版本显示的是应用内的「添加自定义模型 / 服务商」界面，要填的值是一样的——
> 只要把它们对应到界面里相应的字段即可。**我们没有逐一核对每个菜单标签，所以请把
> 具体措辞当作随版本而定。**

> **一句话总结** —— 添加一个把接入地址指向 DeepRouter 的自定义模型：
>
> | 设置项 | 值 |
> |---|---|
> | url（接入地址） | `https://api.deeprouter.co/v1/chat/completions` |
> | apiKey | 你的 DeepRouter 密钥（`sk-...`） |
> | id | 控制台**模型目录（Model Catalog）**里的某个模型 ID（例如 `claude-haiku-4-5`） |
> | vendor | `OpenAI`（DeepRouter 使用 OpenAI 格式） |

---

## 为什么用 DeepRouter

一把密钥就能让 WorkBuddy 访问我们目录里的所有模型（Claude、Qwen、GLM、DeepSeek、Kimi 等等），还有智能路由，以及一个集中查看花费的地方。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API 密钥（API Key）**（以 `sk-` 开头）。在控制台的
   **API Keys** 里可以找到——注册后的欢迎页上也会显示一次。

---

## 操作步骤（配置文件方式）

1. 安装并登录 WorkBuddy。先打开一个项目文件夹，让它创建出配置目录。
2. 找到（或新建）配置文件 `models.json`。WorkBuddy 会在两个位置查找它：
   - **按用户：** `~/.codebuddy/models.json`（Windows 上是 `C:\Users\<you>\.codebuddy\models.json`）
   - **按项目：** `<your-project>/.codebuddy/models.json`
3. 添加一个指向 DeepRouter 的模型条目。把其中的模型 ID 换成 DeepRouter 控制台
   **模型目录（Model Catalog）**里的某个 ID：
   ```json
   {
     "availableModels": ["deeprouter-claude-haiku"],
     "models": {
       "deeprouter-claude-haiku": {
         "id": "claude-haiku-4-5",
         "name": "DeepRouter — Claude Haiku 4.5",
         "vendor": "OpenAI",
         "url": "https://api.deeprouter.co/v1/chat/completions",
         "apiKey": "sk-your-deeprouter-key",
         "maxInputTokens": 200000,
         "maxOutputTokens": 8192
       }
     }
   }
   ```
   - `id` 是 DeepRouter 认识的确切模型名（来自**模型目录 Model Catalog**）。
   - `vendor` 填 `OpenAI`，因为 DeepRouter 以 OpenAI 格式对外提供模型。
   - `url` 是**完整**的 OpenAI 兼容接入地址，包含 `/v1/chat/completions`。
4. 把文件保存为 **UTF-8 无 BOM** 格式（多出一个字节顺序标记 BOM 可能会让 WorkBuddy
   拒绝读取它）。
5. **彻底重启** WorkBuddy，然后在模型选择器里选中你新建的模型。

> 不想把密钥写死在文件里？WorkBuddy 支持在 `apiKey` 里引用环境变量，例如在你电脑上
> 设置好该变量后填 `"apiKey": "${DEEPROUTER_API_KEY}"`。

---

## 验证是否生效

1. 打开 WorkBuddy 的聊天，在模型选择器里选择你的 DeepRouter 模型。
2. 问一句简单的话，比如「Say hello from DeepRouter.」
3. 你应该会收到正常的回复。然后打开 DeepRouter 控制台——这次请求应当会出现在你的
   用量 / 日志里。

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **模型不出现** | 配置没有被加载。请保存为 UTF-8 **无 BOM** 格式，并彻底重启 WorkBuddy。 |
| **404 /「not found」** | `url` 必须是完整接入地址 `https://api.deeprouter.co/v1/chat/completions`，不能只填主机名。 |
| **找不到模型 / 没有回复** | `id` 必须与控制台**模型目录（Model Catalog）**里的某个模型完全一致。 |
| **401 / 鉴权错误** | 密钥填错、被吊销或额度用尽——请到控制台检查 **API Keys** 和账单。 |
| **你的版本里字段看起来不一样** | 措辞因版本 / 平台而异。把同样的四个值——接入地址、密钥、模型 id、OpenAI vendor——对应到你界面上显示的字段即可。 |

---

## 参考

| 项目 | 值 |
|---|---|
| 在哪里设置 | WorkBuddy 的 `models.json`（按用户 `~/.codebuddy/` 或按项目 `.codebuddy/`），或应用内的自定义模型界面 |
| url（接入地址） | `https://api.deeprouter.co/v1/chat/completions` |
| apiKey | 你的 DeepRouter 密钥（`sk-...`） |
| id（模型） | 来自 DeepRouter 控制台**模型目录（Model Catalog）**（例如 `claude-haiku-4-5`） |
| vendor | `OpenAI`（OpenAI 兼容格式） |
| 鉴权 | `Authorization: Bearer <key>`（WorkBuddy 会帮你带上密钥） |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
