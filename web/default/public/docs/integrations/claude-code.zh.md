# Claude Code → DeepRouter

让 Anthropic 的 [Claude Code](https://claude.com/claude-code) 命令行工具通过 DeepRouter 转发。
DeepRouter 直接兼容 **Anthropic 原生 Messages API**，所以 Claude Code **无需改动任何代码**就能用——
你只要把它指向我们的接入地址，再填上一把 DeepRouter 密钥即可。

> **一句话版** —— 设置两个环境变量：
> ```bash
> export ANTHROPIC_BASE_URL=https://api.deeprouter.co
> export ANTHROPIC_AUTH_TOKEN=sk-...your-deeprouter-key...
> ```

---

## 为什么让 Claude Code 走 DeepRouter

- **一把密钥，畅用所有模型。** Claude，外加 Qwen / GLM / DeepSeek / Kimi 等等——全部通过同一个
  兼容 Anthropic 格式的接入地址访问，自动选择模型并在出错时自动切换。
- **智能路由。** DeepRouter 会为每次请求挑选合适的模型/通道（第一层模型路由
  + 第二层通道路由），上游故障时自动切换。
- **计费与审计集中管理。** 整个团队的用量、花费和日志都在 DeepRouter 控制台里。

---

## 准备工作

1. 一个 DeepRouter 账号 → **https://deeprouter.co**
2. 一把 DeepRouter **API Key**（以 `sk-` 开头）。在控制台里获取：
   **控制台 → API Keys**（注册成功后的欢迎页上也会显示一次）。
3. 安装好 Claude Code：
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

---

## 方式 A —— 用环境变量配置（最快）

把下面这些加到你的 shell 配置文件里（`~/.zshrc`、`~/.bashrc` 或 `~/.config/fish/config.fish`）：

```bash
# DeepRouter 接入地址（Claude Code 会自动拼上 /v1/messages —— 末尾不要带斜杠）
export ANTHROPIC_BASE_URL=https://api.deeprouter.co
# 你的 DeepRouter API Key
export ANTHROPIC_AUTH_TOKEN=sk-...your-deeprouter-key...
```

重新加载 shell，然后启动 Claude Code：

```bash
source ~/.zshrc   # 或者直接开一个新终端
cd your-project
claude
```

首次启动时，按 **Esc** 跳过 Anthropic 登录——你是通过 DeepRouter 认证的，
并不是用 Anthropic 订阅。

> **`ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_API_KEY` 怎么选** —— 用 `ANTHROPIC_AUTH_TOKEN`。Claude Code 会把它
> 作为 Bearer token 发送，这正是 DeepRouter 期望的格式。（`ANTHROPIC_API_KEY` 也能用，但每次启动可能会
> 触发 Claude Code 的"自定义密钥"确认提示。）

---

## 方式 B —— 写进 Claude Code 设置（不改 shell）

Claude Code 会读取 `~/.claude/settings.json`。把同样的值放到 `env` 下面：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deeprouter.co",
    "ANTHROPIC_AUTH_TOKEN": "sk-...your-deeprouter-key..."
  }
}
```

这会对所有项目全局生效。如果只想对单个项目生效，就在该项目根目录用 `.claude/settings.json`。

---

## 方式 C —— 用图形界面切换器（CC Switch）

如果你要在多个服务商之间来回切换，[CC Switch](https://github.com/farion1231/cc-switch) 提供一个
可视化的开关，省得你手动改 JSON。

| 字段 | 值 |
|---|---|
| Provider Name | `deeprouter` |
| Website URL | `https://deeprouter.co` |
| API Key | 你的 DeepRouter API Key（`sk-...`） |
| Request URL | `https://api.deeprouter.co` *（末尾不要带斜杠）* |
| API Format / Auth | Anthropic Messages (Native) / `ANTHROPIC_AUTH_TOKEN` |
| Model Configuration | 留空即可使用默认的 Claude 模型 |

点 **Use** 启用，然后在你的项目里启动 Claude Code。

---

## 使用非 Claude 模型

由于 DeepRouter 是按模型名路由的，你可以让 Claude Code 使用我们目录里任何符合 Anthropic 协议的
模型（Qwen、GLM、DeepSeek……）。在 Claude Code 里映射模型槽位：

```bash
# 主模型 + 轻量模型的覆盖设置
export ANTHROPIC_MODEL=deepseek/deepseek-v3
export ANTHROPIC_SMALL_FAST_MODEL=qwen/qwen3-plus
```

或者干脆不设置，让 DeepRouter 的智能路由为每次请求挑选最合适的模型。
可用的模型 ID 请在控制台的 **Model Catalog** 里查看。

---

## 验证是否生效

在 Claude Code 里运行：

```
/status
```

检查：

- **Anthropic base URL** → `https://api.deeprouter.co`
- **Model** → 当前生效的模型

或者直接用 curl 测试接入地址：

```bash
curl https://api.deeprouter.co/v1/messages \
  -H "x-api-key: sk-...your-deeprouter-key..." \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Say hello from DeepRouter."}]
  }'
```

返回 `200` 并带有一个 `content` 块，就说明路由正确。

---

## 排查问题

| 现象 | 解决办法 |
|---|---|
| **认证错误** | 确认 `ANTHROPIC_BASE_URL` 是 `https://api.deeprouter.co`，且密钥有效、控制台里有额度。 |
| **连接超时** | 检查地址**末尾没有斜杠**（应是 `…deeprouter.co`，不是 `…deeprouter.co/`）。 |
| **请求仍然打到 api.anthropic.com** | 有一个旧的 `ANTHROPIC_BASE_URL`，或者还登录着 Anthropic 会话在覆盖配置。运行 `/status` 看实际生效的地址；清掉过时的环境变量再重启。 |
| **用错了模型** | 显式设置 `ANTHROPIC_MODEL`，或在控制台里检查你的路由规则。 |
| **`model not found`** | 这个模型 ID 没有为你的账号开启——请从控制台的 Model Catalog 里挑一个。 |

---

## 参考信息

| 项目 | 值 |
|---|---|
| Anthropic base URL | `https://api.deeprouter.co` |
| Messages 接入点 | `POST /v1/messages`（由 Claude Code 自动拼接） |
| 认证请求头 | `x-api-key: <key>` 或 `Authorization: Bearer <key>` |
| OpenAI 兼容地址 | `https://api.deeprouter.co/v1`（`/chat/completions`） |
| 获取密钥 | DeepRouter 控制台 → API Keys |
