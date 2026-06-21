# Cursor → DeepRouter

让 [Cursor](https://cursor.com) 的聊天对接 DeepRouter，这样它就会用我们的模型，
而不是直接走 OpenAI。Cursor 自带一个专门的设置项——
你只需打开一个开关、粘贴一个网址、再粘贴你的密钥即可。不用写代码，也不用碰终端。

> **一句话总结**——进入 **Settings → Models**，打开 **Override OpenAI Base URL**，然后填写：
>
> | 项目 | 填写内容 |
> |---|---|
> | OpenAI Base URL | `https://api.deeprouter.co/v1` |
> | OpenAI API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model | 从控制台 **Model Catalog**（模型目录）里添加一个（例如 `claude-haiku-4-5`） |

---

## 为什么用 DeepRouter

一把密钥就能让 Cursor 用上我们目录里的所有模型（Claude、Qwen、GLM、DeepSeek、Kimi 等等），自带智能路由，账单也能在一个地方看清楚。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API key**（以 `sk-` 开头）。在控制台的
   **API Keys** 里可以找到——注册后的欢迎页面上也会显示一次。

---

## 操作步骤

1. 打开 Cursor，进入 **Settings**（Mac 按 **Cmd + ,**，Windows/Linux 按 **Ctrl + ,**）。
2. 在左侧边栏点击 **Models**。
3. 向下滚动到 **OpenAI API Key** 区域。
4. 打开 **Override OpenAI Base URL** 开关。
5. 在 **Base URL** 输入框里粘贴：
   ```
   https://api.deeprouter.co/v1
   ```
6. 在 **OpenAI API Key** 输入框里粘贴你的 DeepRouter 密钥（`sk-...`）。
7. 向上滚动到模型列表，点击 **Add Model**，输入一个来自
   DeepRouter 控制台 **Model Catalog**（模型目录）的模型 ID（例如 `claude-haiku-4-5`）。
   确保只打开了这一个模型，这样 Cursor 才不会去用我们没有提供的模型。
8. 点击密钥输入框旁边的 **Verify**。出现成功提示，就说明连接好了。

---

## 关于 Cursor 的一点实话

Cursor 最强大、且由 Cursor 自己托管的功能——**Tab 自动补全、Composer/agent、
行内编辑（inline edit）和 Apply**——是针对 Cursor 自己的后端调校的，**不会走
自定义的 OpenAI base URL**。当你覆盖了 base URL 后，真正使用你 DeepRouter 密钥
和模型的，是 **Chat / Ask 面板**。其余功能可能会回退到 Cursor 自己的服务，或者
在你关掉覆盖开关之前暂时无法使用。

所以：当你想让 Cursor 的聊天由 DeepRouter 模型来回答时，就用这个方法。如果你非常依赖
Tab/Composer，请记住这一点——这是 Cursor 的限制，不是 DeepRouter 的问题。

---

## 验证是否成功

1. 打开 Cursor 的 **Chat** 面板（聊天图标，或按 **Cmd/Ctrl + L**）。
2. 在聊天框底部的模型下拉菜单里选择你的 DeepRouter 模型。
3. 随便问点简单的，比如「Say hello from DeepRouter.」。
4. 你应该会收到正常的回复。然后打开 DeepRouter 控制台——你应该能在
   用量/日志里看到这次请求。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **「Verify」失败 / 连接报错** | 仔细核对 Base URL 是否正好是 `https://api.deeprouter.co/v1`（带 `/v1`，末尾不要多斜杠），并确认密钥正确。 |
| **找不到模型 / 没有回复** | 该模型没有为你的账号启用。请直接从控制台 **Model Catalog** 里挑一个 ID。 |
| **Tab / Composer / Apply 不工作了** | 这是正常的——它们由 Cursor 托管，不走自定义 base URL。关掉覆盖开关就能恢复。 |
| **回复看起来还是 OpenAI 的** | 覆盖开关没打开，或者选中的是 Cursor 内置模型。请重新检查开关，并在聊天下拉菜单里选你的 DeepRouter 模型。 |
| **401 / 鉴权错误** | 密钥错误、被吊销，或额度用完了——在控制台检查 **API Keys** 和账单。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 在哪里设置 | Cursor **Settings → Models → Override OpenAI Base URL** |
| Base URL | `https://api.deeprouter.co/v1` |
| 使用的接口 | `POST /chat/completions`（OpenAI 兼容） |
| 鉴权 | `Authorization: Bearer <key>`（密钥由 Cursor 自动发送） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
