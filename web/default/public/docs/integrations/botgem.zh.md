# BotGem → DeepRouter

[BotGem](https://botgem.com) 是一款桌面端 AI 聊天客户端。它内置了 **OpenAI API
Compatible**（OpenAI API 兼容）服务商选项，而 DeepRouter 正好讲的就是这种格式——所以你只要填一个网址、你的密钥和一个模型名称，就能让
BotGem 连上 DeepRouter。不用写代码，也不用敲命令行。

> **一句话总结** —— 在 **Settings → Service Provider → OpenAI API Compatible** 里填入：
>
> | 字段 | 填什么 |
> |---|---|
> | Base URL | `https://api.deeprouter.co/v1` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model | 从控制台 **Model Catalog**（模型目录）里选（例如 `claude-haiku-4-5`） |

---

## 为什么选 DeepRouter

一把密钥，畅用所有模型—— Claude、Qwen、GLM、DeepSeek、Kimi 等等——自动路由，用量和花费也都在同一个地方一目了然。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API key**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到
   （注册成功后的欢迎页上也会显示一次）。
3. 在你的电脑上装好 **BotGem**。

---

## 操作步骤

1. 打开 BotGem，进入 **Settings**（设置）。
2. 打开 **Service Provider**（服务商）部分。
3. 在服务商列表里，选择 **OpenAI API Compatible**。
4. 填写这些字段：
   - **Base URL**：`https://api.deeprouter.co/v1`
   - **API Key**：你的 DeepRouter 密钥（`sk-...`）
   - **Model List**：从 DeepRouter 控制台的 **Model Catalog**（模型目录）里添加一个模型 ID，例如
     `claude-haiku-4-5`。
5. 点击 **Save**（保存）。

> **关于版本的小提醒：** BotGem 各个版本之间的字段名称和界面布局可能会有变化。
> 关键是选对 **OpenAI API Compatible** 服务商，加上上面那个 **Base URL**——
> 如果你的版本把某个字段叫得稍微不一样（例如用 "API endpoint" 代替
> "Base URL"），它们其实是同一个设置。

### 如果请求失败，试试去掉 `/v1` 的地址

大多数 OpenAI 兼容客户端要求 Base URL **带上** `/v1`
（`https://api.deeprouter.co/v1`），然后自己再补上 `/chat/completions`。少数客户端
会帮你自动加 `/v1`。如果你看到 404 或路径重复的报错，就把 Base URL 改成不带后缀的主机地址
**`https://api.deeprouter.co`**——确保 `/v1` 在最终地址里只出现一次。

---

## 验证是否生效

1. 开一个**新对话**，选择你的 DeepRouter 模型，问一句简单的话，比如
   "Say hello from DeepRouter."
2. 你应该会收到一条正常的回复。
3. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **连接错误 / 404** | 先试 `https://api.deeprouter.co/v1`；如果还不行，就用不带后缀的主机地址 `https://api.deeprouter.co`。确保 `/v1` 只出现一次。 |
| **401 / 鉴权错误** | 密钥填错了、被吊销了，或额度用完了——去控制台检查 **API Keys** 和账单。 |
| **找不到模型 / 回复为空** | 用控制台 **Model Catalog** 里的准确模型 ID，并确认那个模型已被选中。 |
| **找不到对应字段** | 去 **Settings → Service Provider → OpenAI API Compatible** 里找；不同 BotGem 版本的字段名可能略有不同。 |

---

## 参考速查

| 项目 | 值 |
|---|---|
| 在哪里设置 | BotGem **Settings → Service Provider → OpenAI API Compatible** |
| Base URL | `https://api.deeprouter.co/v1`（或不带后缀的主机地址 `https://api.deeprouter.co`） |
| 使用的接口 | `POST /chat/completions`（OpenAI 兼容） |
| 鉴权方式 | `Authorization: Bearer <key>`（BotGem 会帮你发送） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
