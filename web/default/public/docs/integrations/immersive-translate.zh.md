# Immersive Translate → DeepRouter

[Immersive Translate（沉浸式翻译）](https://immersivetranslate.com) 是一款浏览器扩展，
可以对网页、PDF 和字幕进行双语对照翻译。它支持你自带 AI 翻译服务，因此你可以让它使用
经由 DeepRouter 转发的模型来翻译。做法就是在它的设置里添加一个**自定义的、兼容 OpenAI 接口的服务**。

> **一句话总结** —— 在 Immersive Translate 设置中，添加一个兼容 OpenAI 接口的自定义服务：
>
> | 字段 | 填写值 |
> |---|---|
> | Custom API Endpoint（接口地址） | `https://api.deeprouter.co/v1/chat/completions` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model Name（模型名称） | 控制台**模型目录（Model Catalog）**里的模型 ID（例如 `claude-haiku-4-5`） |
>
> 注意：这个扩展需要填写**完整的**接口路径，结尾是 `/chat/completions`，而不是只填 Base URL。

---

## 为什么用 DeepRouter

一把密钥，畅用所有模型 —— Claude、Qwen、GLM、DeepSeek、Kimi 等等 —— 自动路由，并且在同一个地方查看用量和消费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API key**（`sk-...`），在控制台的 **API Keys** 里获取（注册后的欢迎页面上也会显示一次）。
3. 浏览器里已经安装好 **Immersive Translate** 扩展。

---

## 把 DeepRouter 添加为自定义服务

1. 打开 Immersive Translate **设置**（点击扩展图标 → 设置/齿轮，或打开扩展的选项页面）。
2. 进入**翻译服务（Translation Services）**。
3. 滚动到底部，点击**"添加兼容 OpenAI 接口的自定义 AI 翻译服务?"**（不同版本的文字可能略有差异 ——
   找到那个用于添加*自定义、兼容 OpenAI* 服务的选项即可）。
4. 填写各个字段：
   - **自定义翻译服务名称**：随便填，例如 `DeepRouter` —— 这只是个标签，方便你之后在服务列表里选它。
   - **Custom API Endpoint（接口地址）**：`https://api.deeprouter.co/v1/chat/completions`
     *（重要：请粘贴**完整的** URL，包含 `/v1/chat/completions`。这个扩展需要的是完整接口地址，而不是只填基础地址 `…/v1`。）*
   - **API Key**：粘贴你的 DeepRouter 密钥（`sk-...`）。
   - **Model Name（模型名称）**：控制台**模型目录（Model Catalog）**里的模型 ID，例如 `claude-haiku-4-5`。
     请使用完全一致的 ID。
5. 有些版本还会显示一些高级选项，比如*每秒最大请求数*或*每次请求段落数* —— 一开始用默认值就行。
6. 用**测试（test）**按钮（通常在表单右上角）确认连接是否正常。
7. 保存，然后确保**DeepRouter** 已被选为当前生效的翻译服务。

---

## 验证是否生效

1. 打开任意一个外语网页，触发翻译（点扩展的翻译按钮，或用它的快捷键）。
2. 你应该会看到译文出现在原文旁边。
3. 打开 DeepRouter 控制台 —— 这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **鉴权 / 401 错误** | 检查密钥（`sk-...`），并确认它在控制台里还有额度（**API Keys** + 账单）。 |
| **404 / 连接错误** | 接口地址必须是**完整**路径 `https://api.deeprouter.co/v1/chat/completions` —— 不能只填 `…/v1`，也不能只填裸域名。 |
| **找不到模型** | 使用控制台**模型目录（Model Catalog）**里完全一致的模型 ID（例如 `claude-haiku-4-5`）。 |
| **密钥正确但测试按钮失败** | 仔细重新粘贴接口地址（不要有多余空格、不要多一个斜杠），并确认模型名称是你账号有权访问的。 |
| **大页面上出现限流 / 429 错误** | 在该服务的高级选项里调低"每秒最大请求数" / "每次请求段落数"。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 服务类型 | 自定义，兼容 OpenAI |
| Custom API Endpoint（接口地址） | `https://api.deeprouter.co/v1/chat/completions`（完整路径） |
| API Key | 你的 DeepRouter 密钥（`sk-...`） |
| Model Name（模型名称） | 来自控制台 → **模型目录（Model Catalog）** |
| 发送的鉴权请求头 | `Authorization: Bearer <key>` |
| 获取密钥 | 控制台 → **API Keys** |
