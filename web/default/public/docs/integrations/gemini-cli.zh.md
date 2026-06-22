# Google Gemini CLI → DeepRouter

把 Google 的 [Gemini CLI](https://github.com/google-gemini/gemini-cli) 指向 DeepRouter，
这样它的请求就会经过你的 DeepRouter 账户，而不再直接发给 Google。
Gemini CLI 使用的是**原生 Gemini API**，而 DeepRouter 正好提供了一个兼容 Gemini 的接口——
所以这件事只需要设置两个环境变量，完全不用写代码。

> **一句话版** — 设置两个环境变量：
> ```bash
> export GOOGLE_GEMINI_BASE_URL=https://api.deeprouter.co/v1beta
> export GEMINI_API_KEY=sk-...your-deeprouter-key...
> ```

---

## 为什么让 Gemini CLI 走 DeepRouter

- **一把钥匙，所有模型。** 除了 Gemini，目录里还有许多其他模型——都通过同一个接口访问，
  自动选择模型并在失败时自动切换。
- **智能路由。** DeepRouter 会为每个请求挑选合适的模型和通道，上游出问题时自动切换到备用。
- **账单集中管理。** 团队的用量、花费和日志都汇总在 DeepRouter 控制台里。

---

## 开始之前

1. 一个 DeepRouter 账户 → **https://deeprouter.co**
2. 一把 DeepRouter **API Key**（以 `sk-` 开头）。在控制台里获取：
   **API Keys** 页面（注册后欢迎页上也会显示一次）。
3. 已安装 Gemini CLI：
   ```bash
   npm install -g @google/gemini-cli
   ```

---

## 第 1 步 —— 设置两个环境变量

Gemini CLI 靠两个设置来改变请求的去向：

- **`GOOGLE_GEMINI_BASE_URL`** —— 请求发往哪里。把它指向 DeepRouter 的 Gemini 接口。
- **`GEMINI_API_KEY`** —— 你的钥匙。这里填你的 DeepRouter 密钥（不是 Google 的密钥）。

把这两行都加到你的 shell 配置文件里（`~/.zshrc`、`~/.bashrc`，或你的 fish 配置）：

```bash
# Send Gemini CLI to DeepRouter's Gemini-compatible endpoint (no trailing slash)
export GOOGLE_GEMINI_BASE_URL=https://api.deeprouter.co/v1beta
# Authenticate with your DeepRouter key
export GEMINI_API_KEY=sk-...your-deeprouter-key...
```

然后重新加载 shell（或者开一个新的终端窗口）：

```bash
source ~/.zshrc
```

> **为什么用 `/v1beta` 接口？** Gemini CLI 是按照 Google 原生的 Gemini 格式发请求的。
> DeepRouter 的 `…/v1beta` 接口正好认得这个格式，所以 CLI 不用改任何东西就能用。
> （DeepRouter 也有一个 OpenAI 风格的接口，但 Gemini CLI 不会说那种"方言"——
> 见下面的备用方案说明。）

---

## 第 2 步 —— 运行起来

在任意文件夹里启动 Gemini CLI：

```bash
gemini
```

如果它想引导你用 Google 登录，请选择 **API key** 选项（不要选"用 Google 登录"）——
你是通过 DeepRouter 认证的，不是用 Google 账户。

要使用某个特定模型，设置一次即可：

```bash
export GEMINI_MODEL=gemini-2.5-flash
```

具体的模型 ID 从控制台的 **Model Catalog（模型目录）** 里挑选。

---

## 验证是否正常工作

让 Gemini CLI 做点简单的事，比如"say hello"。能正常回复就说明请求确实在经过 DeepRouter。
要进一步确认，可以打开 DeepRouter 控制台，发一次请求后看用量是否往上跳。

你也可以直接用 curl 测试这个接口——返回 `200` 就说明路由正确：

```bash
curl "https://api.deeprouter.co/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Say hello from DeepRouter."}]}]
  }'
```

---

## 如果 Gemini 接口不顺（OpenAI 兼容备用方案）

Gemini CLI 是针对 Google 自家服务器开发和测试的，而 Google **并未**正式支持把它指向
第三方接口——所以不同 CLI 版本的表现可能不一样。如果上面的步骤在你的版本上跑得不顺，
最稳妥的办法是改走 DeepRouter 的 **OpenAI 兼容**接口，配合一个会说这种"方言"的工具：

- 使用 **[Codex CLI](./codex.md)** 或 **[OpenCode](./opencode.md)**，搭配 DeepRouter 的
  `https://api.deeprouter.co/v1` 接口——两者都是一流的 OpenAI 协议客户端。
- 或者在 DeepRouter 前面跑一个本地的 OpenAI 兼容代理（例如 LiteLLM），再把 Gemini CLI
  指向这个代理。

我们宁愿老实告诉你这一点，也不想让你跟一个半残的配置较劲。

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **连接失败或 404 错误** | 确认 `GOOGLE_GEMINI_BASE_URL` 恰好是 `https://api.deeprouter.co/v1beta`——要带上 `/v1beta`，并且**结尾不要有斜杠**。 |
| **认证失败 / 401** | 钥匙不对，或者它用了你的 Google 登录。把 `GEMINI_API_KEY` 设成你的 DeepRouter `sk-...` 密钥，并选择 API key 登录方式。 |
| **请求还是发去了 Google** | 有一个旧的环境变量或旧会话还在生效。运行 `echo $GOOGLE_GEMINI_BASE_URL` 检查一下，然后开一个新终端让新值生效。 |
| **奇怪的参数错误** | 你的 Gemini CLI 版本可能发送了 DeepRouter 接口不接受的字段。改用上面的 OpenAI 兼容备用方案。 |
| **`model not found`** | 这个模型没有为你的账户开通。从控制台的 **Model Catalog（模型目录）** 里挑一个 ID。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| 兼容 Gemini 的接入地址（Base URL） | `https://api.deeprouter.co/v1beta` |
| 环境变量（接入地址） | `GOOGLE_GEMINI_BASE_URL` |
| 环境变量（密钥） | `GEMINI_API_KEY`（填你的 DeepRouter `sk-...` 密钥） |
| 认证请求头 | `x-goog-api-key: <key>`（由 CLI 自动发送） |
| OpenAI 兼容备用接入地址 | `https://api.deeprouter.co/v1` |
| 模型 ID | DeepRouter 控制台 → **Model Catalog（模型目录）** |
| 获取密钥 | DeepRouter 控制台 → **API Keys** |
