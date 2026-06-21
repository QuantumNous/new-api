# LobeChat / LobeHub → DeepRouter

[LobeChat](https://lobehub.com)（也叫 LobeHub）是一款好用的聊天应用，可以直接在浏览器里跑，也可以作为桌面应用使用。它本身就支持对接"OpenAI 风格"的服务——而 DeepRouter 正好就是其中之一。所以把它接到 DeepRouter，只需要：粘贴一个网址、粘贴你的密钥、打开一个模型。不用写代码，也不用敲命令行。

> **一句话版** — 进入 **Settings → AI Service Provider → OpenAI**，把它**打开**，然后填入：
>
> | 字段 | 填什么 |
> |---|---|
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | API Proxy Address（接入地址 / Base URL） | `https://api.deeprouter.co/v1` |
> | Model | 从控制台 **Model Catalog**（模型目录）里添加一个（例如 `claude-haiku-4-5`） |

---

## 为什么用 DeepRouter

一个密钥就能让 LobeChat 用上我们目录里的每一个模型（Claude、Qwen、GLM、DeepSeek、Kimi 等等），还自带智能路由，并且在一个地方就能看到你的花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter **API 密钥**（以 `sk-` 开头）。在控制台的
   **API Keys** 里能找到——注册后欢迎页上也会显示一次。

---

## 操作步骤

1. 打开 LobeChat。点击你的头像 / 齿轮图标，进入 **Settings**（设置）。
2. 在左侧边栏点击 **AI Service Provider**（有些版本把这一栏叫
   **Language Model**）。
3. 在服务商列表里，点击 **OpenAI**。
4. 用顶部的 **Enable** 开关把这个服务商**打开**。
5. 在 **API Key** 输入框里，粘贴你的 DeepRouter 密钥（`sk-...`）。
6. 找到 **API Proxy Address** 输入框（它也可能叫 **Base URL** 或
   **API Endpoint**），粘贴：
   ```
   https://api.deeprouter.co/v1
   ```
7. 滚动到模型列表。要么点击 **Get Model List** 来拉取可用的模型，要么点击
   **Add Custom Model**，手动输入一个来自 DeepRouter 控制台 **Model Catalog**
   的模型 ID（例如 `claude-haiku-4-5`）。然后把它**打开**。
8. （可选）点击密钥输入框旁边的 **Check** 测试一下连接。

> **关于那个 `/v1`** — LobeChat 允许你手动设置接入地址（Base URL），而带不带
> `/v1` 是有讲究的。对 DeepRouter 来说，**要保留 `/v1`**（`https://api.deeprouter.co/v1`）。
> 如果你哪天遇到回复是空白的情况，先回来检查这一点。

---

## 验证是否正常工作

1. 新建一个对话。
2. 在对话顶部的模型选择器里，选中你的 DeepRouter 模型。
3. 随便问点简单的，比如"Say hello from DeepRouter."
4. 你应该会收到一条正常的回复。然后打开 DeepRouter 控制台——这次请求应该会
   出现在你的用量 / 日志里。

---

## 常见问题排查

| 现象 | 怎么解决 |
|---|---|
| **回复是空白 / 空的** | 几乎都是 `/v1` 的问题。确认接入地址（Base URL）正好是 `https://api.deeprouter.co/v1`。 |
| **点 Check 时提示"Connection failed"** | 再检查一遍接入地址（结尾不要带斜杠），以及密钥是否粘贴正确。 |
| **列表里没有任何模型** | 点击 **Add Custom Model**，直接从控制台 **Model Catalog** 里输入一个 ID，然后把它打开。 |
| **找不到模型 / 没有响应** | 这个模型没有为你的账号启用——换一个来自 **Model Catalog** 的 ID。 |
| **401 / 认证错误** | 密钥不对、被吊销了，或者额度用完了——在控制台检查 **API Keys** 和账单。 |

---

## 速查表

| 项目 | 值 |
|---|---|
| 在哪里设置 | LobeChat **Settings → AI Service Provider → OpenAI** |
| API Key | 你的 DeepRouter 密钥（`sk-...`） |
| Base URL（接入地址） | `https://api.deeprouter.co/v1`（保留 `/v1`） |
| 使用的端点 | `POST /chat/completions`（兼容 OpenAI） |
| 认证方式 | `Authorization: Bearer <key>`（LobeChat 会帮你带上密钥） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
