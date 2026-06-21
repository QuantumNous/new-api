# Cherry Studio → DeepRouter

[Cherry Studio](https://cherry-ai.com) 是一款好用的桌面聊天应用（支持 Windows、Mac、
Linux）。它允许你添加自己的"模型服务商"，这样你就能直接接入 DeepRouter，和我们的模型对话。
不用写代码、不用敲命令行——只要在设置里点几下就行。

> **一句话版** —— 在 **设置 → 模型服务商 → 添加** 里，新建一个 **OpenAI** 类型的服务商，填入：
>
> | 字段 | 值 |
> |---|---|
> | 服务商类型 | **OpenAI** |
> | API host（API 地址） | `https://api.deeprouter.co` |
> | API key | 你的 DeepRouter 密钥（`sk-...`） |
> | 模型 | 从控制台 **模型目录（Model Catalog）** 里添加一个（例如 `claude-haiku-4-5`） |

---

## 为什么选 DeepRouter

一把密钥，畅用所有模型——Claude、Qwen、GLM、DeepSeek、Kimi 等等——自动路由，还能在同一个地方查看你的用量和花费。

---

## 开始之前

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API key**（以 `sk-` 开头）。在控制台的 **API Keys** 里可以找到
   （注册后欢迎页上也会显示一次）。
3. 电脑上装好 **Cherry Studio**。

---

## 操作步骤

1. 打开 Cherry Studio。点击左侧栏的 **设置**（齿轮 ⚙️）图标。
2. 打开 **模型服务商**（Model Providers）标签页（有时显示为"模型服务"）。
3. 在服务商列表底部，点击 **+ 添加**。
4. 给它起一个你认得出的名字——比如 **DeepRouter**——**服务商类型** 选 **OpenAI**。点击 **确定 / 添加**。
5. 选中你新建的 DeepRouter 服务商，填写：
   - **API key**：你的 DeepRouter 密钥（`sk-...`）
   - **API host**（也叫 *API 地址* / *Base URL*）：`https://api.deeprouter.co`
6. 滚动到 **模型（Models）** 区域，点击 **+ 添加**（或 **管理**）。输入一个来自 DeepRouter
   控制台 **模型目录（Model Catalog）** 的模型 ID，例如 `claude-haiku-4-5`，然后添加它。
7. 确认服务商的开关（在它面板顶部）已经 **打开**。

### 关于 API host 末尾斜杠的一个小提示

Cherry Studio 对你粘贴的地址有一个小规则：

- 如果地址 **不是** 以斜杠结尾（比如 `https://api.deeprouter.co`），Cherry Studio 会
  自动帮你补上 **`/v1`**——这正是你想要的，得到的就是正确的
  `https://api.deeprouter.co/v1`。
- 如果你加了 **末尾斜杠**（`https://api.deeprouter.co/v1/`），Cherry Studio 会
  **完全按你输入的内容** 使用，**不会** 再添加任何东西。所以如果你想自己写出
  `/v1`，那就写成带末尾斜杠的 `https://api.deeprouter.co/v1/`。

两种写法都行——只是别写成不带末尾斜杠的 `https://api.deeprouter.co/v1`，
否则你会得到重复的 `/v1/v1`。

---

## 验证是否生效

1. 回到服务商面板，点击 API key 旁边的 **检查（Check）** 按钮（Cherry Studio 会
   去 ping 一下服务商，确认密钥和地址正确）。出现成功提示就说明连上了。
2. 新建一个 **对话**，在模型选择器里选你的 DeepRouter 模型，问点简单的，
   比如"Say hello from DeepRouter."。
3. 打开 DeepRouter 控制台——这次请求应该会出现在你的用量/日志里。

---

## 常见问题排查

| 现象 | 解决办法 |
|---|---|
| **"检查"失败 / 连接错误** | 用 `https://api.deeprouter.co`（不带末尾斜杠，让 Cherry 自动补 `/v1`），**或** `https://api.deeprouter.co/v1/`（带末尾斜杠）。不要用不带末尾斜杠的 `/v1`。 |
| **报 404 或路径出现重复** | 你很可能输入了不带末尾斜杠的 `…/v1`，于是变成了 `/v1/v1`。去掉 `/v1`，让 Cherry 自动补。 |
| **401 / 鉴权错误** | 密钥写错了、被吊销了，或额度用完了——去控制台检查 **API Keys** 和账单。 |
| **找不到模型** | 用控制台 **模型目录（Model Catalog）** 里准确的模型 ID。 |
| **服务商变灰 / 没有列出模型** | 把服务商的开关 **打开**，然后在 **模型（Models）** 下至少添加一个模型。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 在哪里设置 | Cherry Studio **设置 → 模型服务商 → 添加（类型：OpenAI）** |
| API host | `https://api.deeprouter.co`（Cherry 会自动补 `/v1`） |
| 使用的接口 | `POST /chat/completions`（兼容 OpenAI） |
| 鉴权方式 | `Authorization: Bearer <key>`（Cherry 会帮你发送） |
| 模型 ID | DeepRouter 控制台 → **模型目录（Model Catalog）** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
