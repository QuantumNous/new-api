# 如何把 DeepRouter 配置到你的 AI 工具（CONNECT）

> 实测可用配置合集 · 2026-06-08 · 所有示例均对活网关验证返回 200。
> 这是面向「开发者模式」的接入手册，也是 `/keys` Setup guide 开发者模式的内容源。
> Casual（非技术）用户不需要看这页 —— 见 `tasks/key-setup-guide-prd.md`。

## 你需要的三样东西

| 项 | 本地 dev 值 | 生产值 |
|---|---|---|
| **API Key**（调用密钥） | 你在 `/keys` 创建的 `sk-...` | 同 |
| **Base URL** | `http://localhost:3300/v1` | `https://<你的 DeepRouter 域名>/v1` |
| **模型名（model）** | `deeprouter-auto` | `deeprouter-auto`（自动路由到最合适的底层模型） |

> ⚠️ 注意：
> - Base URL 推荐网关端口 **3300**（不依赖前端 dev server）。2026-06-11 起 dev server 也代理了 `/v1`，所以 `http://localhost:17231/v1` 在 dev server 运行期间同样可用。
> - 模型名用 **`deeprouter-auto`**，**不是** `deeprouter`（后者网关返 503）。
> - 网关同时兼容 **OpenAI**（`/v1/chat/completions`）和 **Anthropic**（`/v1/messages`）
>   两种协议，自动跨协议转换；鉴权 `Authorization: Bearer <key>` 或 `x-api-key: <key>` 均可。

---

## 1. Claude Code（Anthropic 协议）

Claude Code 通过环境变量指向自定义网关。设置后正常使用 `claude`：

```bash
export ANTHROPIC_BASE_URL="http://localhost:3300"      # 生产换成你的域名（不带 /v1）
export ANTHROPIC_AUTH_TOKEN="sk-你的key"
export ANTHROPIC_MODEL="deeprouter-auto"               # 主模型
export ANTHROPIC_SMALL_FAST_MODEL="deeprouter-auto"    # 小/快模型槽
```

或写进 `~/.claude/settings.json`（对所有会话生效）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3300",
    "ANTHROPIC_AUTH_TOKEN": "sk-你的key",
    "ANTHROPIC_MODEL": "deeprouter-auto",
    "ANTHROPIC_SMALL_FAST_MODEL": "deeprouter-auto"
  }
}
```

- `ANTHROPIC_BASE_URL` 填到**域名/端口**即可，Claude Code 会自己补 `/v1/messages`。
- 必须把 model 覆盖成 `deeprouter-auto`，否则 Claude Code 默认发 `claude-*`，
  在没有启用 Anthropic 渠道的部署上会 503。生产若已启用真实 Claude 渠道，
  可直接用 `claude-sonnet-4-x` 等原名。
- 实测：`POST /v1/messages` + `deeprouter-auto` → 200（自动转协议路由）。

## 2. opencode（OpenAI 兼容）

`~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deeprouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepRouter",
      "options": {
        "baseURL": "http://localhost:3300/v1",
        "apiKey": "sk-你的key"
      },
      "models": { "deeprouter-auto": { "name": "DeepRouter Auto" } }
    }
  }
}
```

然后跑 `opencode` → `/models` 选 **DeepRouter → DeepRouter Auto**。实测返回 200。

## 3. Cursor / 任何「OpenAI 兼容」客户端（Cherry Studio / ChatBox / LobeChat …）

在客户端设置里找一个「OpenAI / OpenAI 兼容 / 自定义」provider，填：

- **Base URL / API Base / Endpoint**：`http://localhost:3300/v1`
- **API Key**：`sk-你的key`
- **Model**：`deeprouter-auto`

保存即可。（Cursor: Settings → Models → OpenAI API Key → 勾 "Override Base URL"。）

## 4. 原始 API（curl / 代码）

OpenAI 协议：
```bash
curl http://localhost:3300/v1/chat/completions \
  -H "Authorization: Bearer sk-你的key" \
  -H "Content-Type: application/json" \
  -d '{"model":"deeprouter-auto","messages":[{"role":"user","content":"你好"}]}'
```

Anthropic 协议：
```bash
curl http://localhost:3300/v1/messages \
  -H "x-api-key: sk-你的key" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"deeprouter-auto","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}'
```

Python（OpenAI SDK）：
```python
from openai import OpenAI
client = OpenAI(api_key="sk-你的key", base_url="http://localhost:3300/v1")
r = client.chat.completions.create(model="deeprouter-auto",
    messages=[{"role":"user","content":"你好"}])
print(r.choices[0].message.content)
```

---

## 出错怎么办（响应头 `X-Deeprouter-Routed-*` 会显示实际路由的模型）

| 现象 | 原因 / 解决 |
|---|---|
| 401 | key 错了 → 去 `/keys` 重新生成 |
| 402 / insufficient balance | 余额不足 → 充值 |
| 503 `model_not_found` / `No available channel` | 该 model 名没有可用渠道。用 `deeprouter-auto`；或检查该 model 是否有启用的 channel |
| 503 `upstream_capacity_exceeded` | 上游繁忙 → 稍后重试 |
| 429 `tenant_quota_exceeded` | 已达用量上限 |
