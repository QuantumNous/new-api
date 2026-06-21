# Chatbox → DeepRouter

[Chatbox](https://chatboxai.app) 是一款简单好用的桌面（也有网页版）AI 聊天应用。它可以连接任何"兼容 OpenAI"的服务，而 DeepRouter 正好就是这样的服务——所以你只需添加一个自定义服务商，粘贴一个网址和你的密钥，就能开始聊天。不用写代码，也不用碰命令行。

> **一句话版** —— 在 **Settings → Model Provider → Add** 中，选择 **OpenAI API Compatible**，然后填入：
>
> | 字段 | 填什么 |
> |---|---|
> | API Host | `https://api.deeprouter.co/v1` |
> | API Key | 你的 DeepRouter 密钥（`sk-...`） |
> | Model | 来自控制台 **Model Catalog**（模型目录），例如 `claude-haiku-4-5` |

---

## 为什么用 DeepRouter

一个密钥就能让 Chatbox 用上我们目录里的所有模型（Claude、Qwen、GLM、DeepSeek、Kimi 等等），自带智能路由，消费也集中在一处查看。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一个 DeepRouter **API key**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到（注册后的欢迎页面也会显示一次）。
3. 已安装 **Chatbox**（或打开网页版）。

---

## 操作步骤

1. 打开 Chatbox，点击 **Settings**（齿轮 ⚙️ 图标）。
2. 打开 **Model Provider** 下拉菜单，选择 **Add**（或 **Add Custom Provider**）。
3. 给这个服务商起一个你认得出的名字，例如 **DeepRouter**。
4. 在 **API Mode / provider type**（接口模式/服务商类型）处，选择 **OpenAI API Compatible**。
5. 填写各字段：
   - **API Host**：`https://api.deeprouter.co/v1`
   - **API Key**：你的 DeepRouter 密钥（`sk-...`）
   - **API Path**：**留空**——Chatbox 默认就会用 `/chat/completions`。
6. 至少添加一个 **Model**，方法是输入 DeepRouter 控制台 **Model Catalog**（模型目录）里的一个模型 ID，例如 `claude-haiku-4-5`。
7. 点击 **Save**（如果有 **Check** 按钮，可以点一下测试连接）。

### 关于地址的说明（两种都对的写法）

Chatbox 会把最终请求拼成 **API Host + API Path**，其中默认路径是 `/chat/completions`。下面两种设置都能用：

- **最简单：** API Host = `https://api.deeprouter.co/v1`，API Path = *(留空)*。最终地址 = `https://api.deeprouter.co/v1/chat/completions`。✅
- **裸主机：** 有些 Chatbox 版本会把路径默认成 `/v1/chat/completions`。这种情况下把 API Host 写成 `https://api.deeprouter.co`（不带 `/v1`）。如果你在主机和路径里**都**写了 `/v1`，就会出现重复的 `/v1/v1`——只能保留一处。

如果请求失败，最快的排查办法就是检查完整地址里 `/v1` 是不是**只出现一次**。

---

## 验证是否成功

1. 新开一个 **chat**（对话），在模型选择器里选你的 DeepRouter 模型。
2. 随便问点简单的，比如 "Say hello from DeepRouter."，你应该会收到正常的回复。
3. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **连接错误 / 404** | 确保 API Host + API Path 里 `/v1` **只出现一次**。最省事的写法：Host 填 `https://api.deeprouter.co/v1`，Path 留空。 |
| **401 / 鉴权错误** | 密钥不对、已被吊销，或额度用完了——到控制台检查 **API Keys** 和账单。 |
| **找不到模型 / 回复为空** | 使用控制台 **Model Catalog** 里准确的模型 ID，并确认对话里已经选中了那个模型。 |
| **点发送没反应** | 确认服务商类型是 **OpenAI API Compatible**，并且该服务商已被选中/启用。 |

---

## 参考速查

| 项目 | 内容 |
|---|---|
| 在哪里设置 | Chatbox **Settings → Model Provider → Add → OpenAI API Compatible** |
| API Host | `https://api.deeprouter.co/v1`（API Path 留空） |
| 使用的接口 | `POST /chat/completions`（兼容 OpenAI） |
| 鉴权方式 | `Authorization: Bearer <key>`（Chatbox 会自动帮你发送） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
