# 完整指南：把任何工具接入 DeepRouter

> **适合谁看** —— 任何已经在用 AI 工具（Claude Code、Cursor、聊天应用、
> 你自己的脚本……）、并且希望让它的请求改走 **DeepRouter**、而不是直接连某一家模型厂商的人。
> 你**不需要**是程序员。只要你会复制一个密钥、粘贴到设置框里，就能搞定。

这份文档把整个思路一次讲清楚。之后每个工具都有自己的简短页面（文末有链接），里面写明那个工具具体该点哪些按钮。

---

## “接入 DeepRouter”到底是什么意思

每个 AI 工具想和模型对话，都需要知道两件事：

1. **请求发到哪里** —— 一个*地址*，叫做 **接入地址（base URL）**。
2. **你是谁** —— 一个保密的 **API 密钥（API key）**。

默认情况下，大多数工具出厂时都指向某一家厂商（比如 Anthropic 或 OpenAI），并配了那家厂商的密钥。
**你要做的只是把这两个值换掉**，让工具改去连 DeepRouter。
之后 DeepRouter 会帮你挑选合适的模型、在某个模型挂了时自动切换备用，并把所有花费统一计费。

就这么简单。什么都不用重新安装。工具的样子和用法都和原来一模一样。

> ![改变的只是 base URL + 密钥](./images/01-concept-before-after.png)
> <!-- IMAGE 01 — a simple before/after diagram: "Tool → Anthropic/OpenAI" on the left,
>      "Tool → DeepRouter → any model" on the right. Caption: only two values change. -->

---

## 第 1 步 —— 拿到你的 DeepRouter API 密钥

这一步只需做一次。所有工具都用同一个密钥。

1. 打开 **[deeprouter.co](https://deeprouter.co)** 并登录（或注册）。

   > ![DeepRouter 登录](./images/02-signin.png)
   > <!-- IMAGE 02 — the deeprouter.co landing/sign-in page, arrow on the Sign in / Get started button. -->

2. 进入**控制台（console）**，再打开 **API Keys**。
3. 点击 **Create key**（或者直接复制页面上显示的默认密钥）。把这个值复制下来 —— 它以 `sk-` 开头。

   > ![API Keys 页面 —— 复制你的密钥](./images/03-api-keys.png)
   > <!-- IMAGE 03 — console → API Keys page. Highlight: the "Create key" button and the copy icon
   >      next to a key that starts with sk-. This is the single most important screenshot. -->

4. 先把它存到一个安全的地方放一会儿 —— 下一步就会把它填进你的工具里。

> 💡 在你刚注册完时，DeepRouter 还会在欢迎页面上**一次性显示一个默认密钥**。
> 如果你当时看到了却没复制，别担心 —— 直接在这里新建一个就行。
>
> ![欢迎页面的默认密钥](./images/04-welcome-default-key.png)
> <!-- IMAGE 04 — welcome screen showing "Your default API key (shown once)". Optional. -->

---

## 第 2 步 —— 找到正确的接入地址

工具里会问你“API 类型”或“服务商（provider）”。按下面对照表填对应的地址：

| 你的工具的 API 类型 | 要粘贴的 base URL |
|---|---|
| **OpenAI**（最常见） | `https://api.deeprouter.co/v1` |
| **Anthropic / Claude** | `https://api.deeprouter.co` |
| **Gemini / Google** | `https://api.deeprouter.co/v1beta` |

**不确定选哪个？** 选 **OpenAI** —— 大多数应用用的都是它。地址末尾千万不要加斜杠。

> ![该用哪个 base URL](./images/05-base-url-table.png)
> <!-- IMAGE 05 — a clean graphic of the three-row table above. Used as a reference card. -->

---

## 第 3 步 —— 把这两个值填进你的工具

设置方式其实只有**三种**。找到你的工具属于哪一种；对应工具的页面里有精确的点击步骤。

### 方式 A —— 在输入框里填设置（大多数应用）

聊天应用和编辑器（Cherry Studio、Chatbox、Cursor、LobeChat、OpenCat、Cline……）都有一个
**设置 → 模型服务商（Settings → Model Provider）** 的界面。你要做的是：

1. 新增 / 选择一个类型为 **OpenAI**（或 Anthropic）的服务商。
2. 粘贴第 2 步里的 **base URL**。
3. 粘贴第 1 步里的 **API 密钥**。
4. 从控制台的 **Model Catalog**（模型目录）里加一个模型名（例如 `claude-haiku-4-5`）。
5. 保存。完成。

> ![典型的服务商设置界面](./images/06-style-a-settings.png)
> <!-- IMAGE 06 — a representative app (e.g. Cherry Studio or Chatbox) settings screen with the
>      base URL field, API key field, and model field each circled and numbered 1-2-3. -->

### 方式 B —— 在终端里设置（命令行编程工具）

像 **Claude Code**、**Codex**、**Gemini CLI** 这类工具，会从你的环境变量里读取配置。
你只要把两行粘到终端的配置文件里。以 **Claude Code** 为例：

```bash
export ANTHROPIC_BASE_URL=https://api.deeprouter.co
export ANTHROPIC_AUTH_TOKEN=sk-...your-key...
```

然后重启工具。（每个命令行工具的页面里都列了它各自精确的变量名。）

> ![命令行工具的终端环境变量](./images/07-style-b-terminal.png)
> <!-- IMAGE 07 — a terminal window showing the two export lines, then `claude` starting and the
>      status bar showing api.deeprouter.co. -->

### 方式 C —— 用 CC Switch 应用（点点鼠标即可，适用于 Claude Code）

如果你不想碰终端，**[CC Switch](./cc-switch.md)** 是一个免费的小应用，能帮你把配置改好。
你只要填一个表单（名称、地址 `https://api.deeprouter.co`、你的密钥），再点 **Use** 即可。

> ![CC Switch 的添加服务商表单](./images/08-style-c-ccswitch.png)
> <!-- IMAGE 08 — CC Switch "add provider" form filled in with the DeepRouter values, arrow on the
>      Use/Enable button. -->

---

## 第 4 步 —— 确认能用了

有两种办法：

- **在命令行编程工具里：** 运行 `/status`，确认 base URL 显示为 `https://api.deeprouter.co`。
- **任何工具 / 快速验证：** 把下面这段粘进终端（把密钥换成你自己的）。
  如果返回一段正常的 JSON，就说明 DeepRouter 和你的密钥都没问题：

  ```bash
  curl https://api.deeprouter.co/v1/chat/completions \
    -H "Authorization: Bearer sk-...your-key..." \
    -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5","messages":[{"role":"user","content":"hi"}]}'
  ```

> ![成功的 /status 和 curl](./images/09-verify.png)
> <!-- IMAGE 09 — split image: left = a tool's /status showing api.deeprouter.co; right = a curl
>      command returning a 200 JSON response. -->

---

## 第 5 步 —— 如果出了问题

先跑一遍第 4 步的 curl。**如果 curl 能成功、但工具不行，那问题就出在工具的设置上** ——
基本上都是下面这几种情况之一：

| 你看到的现象 | 解决办法 |
|---|---|
| 鉴权 / 401 错误 | 密钥填错了，或者额度用完了。从控制台 → API Keys 重新复制一遍。 |
| 连接超时 | 你在地址末尾多留了一个**斜杠**。把它去掉。 |
| 仍然在连 api.anthropic.com / api.openai.com | 有个旧设置、或者某个已登录的厂商会话在覆盖配置。重新检查 base URL 并重启工具。 |
| `model not found` | 这个模型没在你的账号上开通 —— 从 **Model Catalog** 里挑一个。 |
| 工具里根本没有地方填 base URL | 它被锁死在某一家厂商上了。参见 [其他任意工具](./others.md) 里的代理变通方案。 |

---

## 第 6 步 —— 找到你那个工具的具体指南

同一个密钥、同一个思路 —— 这些页面只是展示每个工具具体该点哪些按钮。

**命令行编程工具：** [Claude Code](./claude-code.md) · [Codex](./codex.md) · [Gemini CLI](./gemini-cli.md) · [OpenCode](./opencode.md)

**编辑器：** [Cursor](./cursor.md) · [GitHub Copilot](./copilot.md) · [Cline](./cline.md) · [Zed](./zed.md)

**桌面端与聊天应用：** [Claude Cowork](./claude-coworks.md) · [OpenClaw](./openclaw.md) · [Cherry Studio](./cherry-studio.md) · [BotGem](./botgem.md) · [Chatbox](./chatbox.md) · [LobeChat](./lobehub.md) · [OpenCat](./opencat.md) · [NextChat](./nextchat.md) · [WorkBuddy](./workbuddy.md)

**辅助工具、SDK 与框架：** [CC Switch](./cc-switch.md) · [OpenAI SDK](./openai-sdk.md) · [LangChain](./langchain.md) · [LlamaIndex](./llamaindex.md)

**浏览器及其他：** [Immersive Translate](./immersive-translate.md) · [其他任意工具](./others.md)

---

## 一眼速查表

| 协议 | Base URL | 调用的接口 | 鉴权请求头 |
|---|---|---|---|
| Anthropic | `https://api.deeprouter.co` | `POST /v1/messages` | `x-api-key` 或 `Authorization: Bearer` |
| OpenAI | `https://api.deeprouter.co/v1` | `POST /chat/completions` | `Authorization: Bearer` |
| Gemini | `https://api.deeprouter.co/v1beta` | `POST /models/...:generateContent` | `x-goog-api-key` 或 key 参数 |

密钥：控制台 → **API Keys**（`sk-...`）。模型：控制台 → **Model Catalog**。

---

*本指南的截图正在制作中，很快就会出现在这里。*
