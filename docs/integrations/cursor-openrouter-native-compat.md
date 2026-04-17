# Cursor + OpenRouter + new-api 原生兼容性建议

> 本文档为**架构与实现建议**，建议 `new-api` 在原生代码层提升对 Cursor 的兼容性。  
> 本文主要是提供可评估、可裁剪、可演进的兼容优化建议性方案。

---

## 1. 背景

在 `Cursor -> new-api -> OpenRouter` 链路中，用户经常遇到以下报错：

- `field messages is required`
- `Tool '' not found in provided tools`
- `Invalid input: expected "function"`

这些问题通常不是“模型不可用”，而是**请求协议形态不一致**导致的兼容性问题：

- Cursor 在部分模型/场景下发送更接近 Responses API 的字段（例如 `input` / `max_output_tokens`）
- 上游（含 OpenRouter 及其下游 provider）在 `chat/completions` 链路中更期望标准 `messages` + `tools(function)` 结构
- 工具调用在多轮对话中存在空名称、孤立 tool_result、非标准工具类型等边界情况

---

## 2. 文档目标

**原生兼容增强建议**：

1. 在 `new-api` 内部进行请求规范化（normalization）
2. 尽量不影响现有用户（通过开关控制，默认关闭）
3. 提供可观测、可回滚、可验证的实施路径

---

## 3. 设计原则（建议）

- **可配置**：兼容模式建议可开关，默认关闭
- **最小侵入**：仅在 `chat/completions` 路由应用
- **前置规范化**：在模型分发前统一请求形态
- **可回滚**：异常时可快速关闭兼容模式恢复默认行为

---

## 4. 建议新增配置项

> 配置名仅为建议，可按项目规范调整。

- `CURSOR_COMPAT_MODE`（bool，默认 `false`）  
  是否启用 Cursor 兼容规范化逻辑

- `CURSOR_COMPAT_MAX_TOKENS_CAP`（int，默认 `0`）  
  输出 token 上限；`0` 表示不限制

- `CURSOR_COMPAT_DEBUG_LOG`（bool，默认 `false`）  
  是否记录兼容修复标签

---

## 5. 兼容规范化建议（核心）

以下步骤建议在请求进入 provider 转发前执行：

### 5.1 Responses 风格字段兼容

当请求命中 `POST /v1/chat/completions` 且出现 `input`（但缺少 `messages`）时：

- 将 `input` 转换为 `messages`
- 将 `instructions` 转换为 system message（如存在）
- 将 `max_output_tokens` 映射为 `max_tokens`
- 清理明显仅属于 Responses 风格的字段（按项目实际字段集裁剪）

**目标**：避免 `field messages is required`

---

### 5.2 `tools` 结构归一化

建议将工具定义归一化到 Chat Completions 常见结构：

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "...",
    "parameters": { "type": "object", "properties": {} }
  }
}
```
