# OpenAI Codex CLI → DeepRouter

把 OpenAI 的 [Codex CLI](https://developers.openai.com/codex) 指向 DeepRouter，
这样它的请求就会经过你的 DeepRouter 账户，而不是直接发给 OpenAI。
Codex 使用 **OpenAI 协议**，而 DeepRouter 提供了一个 OpenAI 兼容的接口，
所以这只是改一个配置文件的事——不用写任何代码。

> **一句话版** — 在 `~/.codex/config.toml` 里加一个 provider，并设置一个 API Key 就行。
> ```toml
> # ~/.codex/config.toml
> model = "claude-haiku-4-5"
> model_provider = "deeprouter"
>
> [model_providers.deeprouter]
> name = "DeepRouter"
> base_url = "https://api.deeprouter.co/v1"
> env_key = "DEEPROUTER_API_KEY"
> wire_api = "chat"
> ```
> ```bash
> export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
> ```

---

## 为什么让 Codex 走 DeepRouter

- **一把钥匙，所有模型。** GPT 系列、Claude，还有许多开源模型——全都能通过
  同一个 OpenAI 风格的接口访问，并自带自动模型路由和故障转移。
- **智能路由。** DeepRouter 会为每个请求挑选合适的模型和通道，当某个上游出问题时
  自动切换。
- **账单集中管理。** 你团队的用量、花费和日志都集中在 DeepRouter 控制台里。

---

## 开始之前

1. 一个 DeepRouter 账户 → **https://deeprouter.co**
2. 一把 DeepRouter **API Key**（以 `sk-` 开头）。在控制台获取：
   **API Keys** 页面（注册后欢迎页上也会显示一次）。
3. 已安装 Codex CLI：
   ```bash
   npm install -g @openai/codex
   ```

---

## 第 1 步 — 打开（或新建）Codex 配置文件

文件位置：

```
~/.codex/config.toml
```

在 Mac 上就是 `/Users/you/.codex/config.toml`。如果 `.codex` 文件夹或这个文件
还不存在，就自己建一个。（开头那个点表示它是隐藏文件——在 Finder 里按
`Cmd‑Shift‑.` 可以显示隐藏文件，或者直接在终端里编辑它。）

> **重要：** Codex 只会从你 home 目录下的这个**用户级**文件里读取 provider 设置。
> 项目文件夹里的 `config.toml` 不会被用来读取 provider。

---

## 第 2 步 — 把 DeepRouter 添加为一个 provider

把下面这段粘贴到 `~/.codex/config.toml` 里：

```toml
# Which model to use by default (pick any ID from the DeepRouter Model Catalog)
model = "claude-haiku-4-5"
# Use the DeepRouter provider defined below
model_provider = "deeprouter"

[model_providers.deeprouter]
name = "DeepRouter"
# DeepRouter's OpenAI-compatible endpoint (note: ends in /v1, no trailing slash)
base_url = "https://api.deeprouter.co/v1"
# Name of the environment variable that holds your key (set in Step 3)
env_key = "DEEPROUTER_API_KEY"
# DeepRouter speaks Chat Completions
wire_api = "chat"
```

每一行是干什么的，说人话：

- **`model`** — Codex 要请求的模型。从控制台 **Model Catalog（模型目录）** 里复制一个完整的 ID。
- **`model_provider`** — 告诉 Codex 用 `deeprouter` 这一段配置，而不是内置的 OpenAI。
- **`base_url`** — 请求发往哪里。Codex 会自动在后面拼上 `/chat/completions`。
- **`env_key`** — Codex 从这个环境变量里读取你的 Key，这样密钥就不会直接写在文件里。
- **`wire_api`** — API 的“方言”。DeepRouter 的 `/v1` 接口提供的是 **Chat Completions**，所以填 `chat`。

> **关于 `wire_api` 的提醒。** 较新版本的 Codex 更倾向于 `wire_api = "responses"`（OpenAI 的
> Responses API）。但 DeepRouter 的 `/v1` 接口是 **Chat Completions**，所以请用 `wire_api = "chat"`。
> 如果你的 Codex 版本用 `"chat"` 就拒绝启动，说明你这个版本已经去掉了 Chat 方言——
> 请更新到仍然支持它的版本，或者去 DeepRouter 控制台查看最新推荐设置。

---

## 第 3 步 — 把 Key 放进环境变量

把你的 DeepRouter Key 加到 shell 配置文件里（`~/.zshrc`、`~/.bashrc`，或你的 fish 配置）：

```bash
export DEEPROUTER_API_KEY=sk-...your-deeprouter-key...
```

然后重新加载 shell（或者干脆开一个新终端窗口）：

```bash
source ~/.zshrc
```

---

## 验证是否生效

在任意项目文件夹里启动 Codex：

```bash
cd your-project
codex
```

随便问它一句，比如“say hello”。能正常回复就说明流量已经走 DeepRouter 了。

你也可以直接用 curl 确认接口——返回 `200` 就说明路由正确：

```bash
curl https://api.deeprouter.co/v1/chat/completions \
  -H "Authorization: Bearer $DEEPROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

想再确认是哪个账户在扣费，可以打开 DeepRouter 控制台，发一次请求后看着用量往上涨。

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **连接错误或 404** | 确认 `base_url` 正好是 `https://api.deeprouter.co/v1`——要带 `/v1`，而且**结尾不要有斜杠**。 |
| **认证失败 / 401** | Key 错了或者是空的。检查 `DEEPROUTER_API_KEY` 已设置（`echo $DEEPROUTER_API_KEY`），并且文件里的 `env_key` 和这个名字完全一致。 |
| **provider 设置被忽略** | 你改的是项目本地的 `config.toml`。provider 配置只在你 home 目录下的 `~/.codex/config.toml` 里才生效。 |
| **还是发去了 OpenAI** | 旧的 `model_provider` 在起作用，或者别处的配置盖过了它。确认 `model_provider = "deeprouter"`，并在新终端里重启 Codex。 |
| **用 `wire_api = "chat"` 起不来** | 你的 Codex 版本去掉了 Chat 方言。更新到支持它的版本（见第 2 步的提醒）。 |
| **`model not found`** | 这个模型在你的账户里没有开通。从控制台 **Model Catalog（模型目录）** 里挑一个 ID。 |

---

## 参考速查

| 项目 | 值 |
|---|---|
| 配置文件 | `~/.codex/config.toml`（仅用户级） |
| OpenAI 兼容的 Base URL | `https://api.deeprouter.co/v1` |
| 接口 | `POST /chat/completions`（由 Codex 自动拼接） |
| `wire_api` | `chat` |
| 鉴权 | `Authorization: Bearer <key>`（Codex 发送你 `env_key` 对应的值） |
| 模型 ID | DeepRouter 控制台 → **Model Catalog（模型目录）** |
| 获取 Key | DeepRouter 控制台 → **API Keys** |
