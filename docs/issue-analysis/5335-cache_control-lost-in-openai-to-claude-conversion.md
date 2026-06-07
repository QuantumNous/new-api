# Issue #5335 分析：OpenAI→Claude 转换层 cache_control 被丢弃

> 状态：OPEN  
> 标签：bug  
> 与我当前修复的关系：**完全无关**（属于协议转换层数据透传遗漏，非 URL 拼接问题）  
> 创建时间：2026-06-06 15:38  
> 记录时间：2026-06-06

---

## 1. 问题概述

当用户通过 `/v1/chat/completions`（OpenAI 兼容入口）请求 Claude / AWS Bedrock(Claude) 渠道时，content 分块上携带的 `cache_control` 标记在 **OpenAI→Claude 协议转换层** 被静默丢弃。

后果：**上游 Anthropic 端 Prompt Cache 永不命中**，`cache_creation_tokens` 和 `cache_read_tokens` 始终为 0。

同一渠道直接走原生 `/v1/messages` 路径则缓存正常——证明问题**仅在转换层**。

---

## 2. 经济损失评估

Anthropic Prompt Cache 机制：
- `cache_read` 费用约为正常 `input` 费用的 **1/10**
- 典型场景下（如多轮对话、重复系统提示），重复 token 占比可达 70~90%

**丢弃 `cache_control` 意味着用户每次请求损失约 90% 的 prompt cache 费用节省。**

---

## 3. 完整根因链路

链路：`客户端 /v1/chat/completions` → `ParseContent()` → `RequestOpenAI2ClaudeMessage()` → `Claude 上游`

### 3.1 第 1 处：解析层丢失（`dto/openai_request.go`）

客户端发送的 content 块示例：
```json
{
  "type": "text",
  "text": "长系统提示",
  "cache_control": {"type": "ephemeral"}
}
```

`Message.ParseContent()` 中处理 `ContentTypeText` 分支：
```go
// dto/openai_request.go (~L260)
case ContentTypeText:
    if text, ok := contentItem["text"].(string); ok {
        contentList = append(contentList, MediaContent{
            Type: ContentTypeText,
            Text: text,
            // ❌ cache_control 完全没有被读取！
        })
    }
```

`MediaContent` 虽然定义了 `CacheControl json.RawMessage`（L308），但 `ParseContent()` 在构建对象时**完全没有读取 `cache_control` 键**。

### 3.2 第 2 处：转换层丢失（`relay/channel/claude/relay-claude.go`）

`RequestOpenAI2ClaudeMessage()` 构建 Claude 请求体时，有两段均未透传 `CacheControl`：

**system 消息分支：**
```go
// relay/channel/claude/relay-claude.go (~L340)
systemMessages = append(systemMessages, dto.ClaudeMediaMessage{
    Type: "text",
    Text: common.GetPointer[string](ctx.Text),
    // ❌ CacheControl 没有透传！
})
```

**普通消息 text 分支：**
```go
// relay/channel/claude/relay-claude.go (~L385)
claudeMediaMessages = append(claudeMediaMessages, dto.ClaudeMediaMessage{
    Type: "text",
    Text: common.GetPointer[string](mediaMessage.Text),
    // ❌ CacheControl 没有透传！
})
```

**结论：** 即使解析层修复了，转换层也会再次丢弃。两段代码均需修改。

---

## 4. 代码位置速查

| 位置 | 文件 | 行号范围 | 说明 |
|---|---|---|---|
| Issue 报告 | - | [#5335](https://github.com/QuantumNous/new-api/issues/5335) | 作者已给出最小可复现请求 |
| 解析层 | `dto/openai_request.go` | ~L260 (`ParseContent` → `ContentTypeText`) | 未读取 `cache_control` |
| 转换层 system | `relay/channel/claude/relay-claude.go` | ~L340 | 未透传 `CacheControl` |
| 转换层 messages | `relay/channel/claude/relay-claude.go` | ~L385 | 未透传 `CacheControl` |
| DTO 定义 | `dto/openai_request.go` | L308 | `MediaContent.CacheControl` 字段已存在 |
| DTO 定义 | `dto/claude.go` | L30, L211 | `ClaudeMediaMessage.CacheControl` 字段已存在 |
| 反向转换 | `service/convert.go` | L115, L156 | `Claude→OpenAI` 方向已正确透传 `CacheControl` |

---

## 5. 复现方式

1. 配置一个 Claude 或 AWS Bedrock(Claude) 渠道
2. 通过 `/v1/chat/completions` 发送请求，content 用数组分块，并在文本块上带 `cache_control`：

```json
{
  "model": "claude-3-5-sonnet",
  "messages": [
    {
      "role": "system",
      "content": [
        {"type": "text", "text": "<长系统提示>", "cache_control": {"type": "ephemeral"}}
      ]
    },
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "hello", "cache_control": {"type": "ephemeral"}}
      ]
    }
  ]
}
```

3. 重复发送以触发缓存
4. 查看 usage / 日志：`cache_creation` 与 `cache_read` 均为 0

---

## 6. 影响面

| 调用路径 | 是否受影响 | 原因 |
|---|---|---|
| `/v1/chat/completions` → Claude 渠道 | ⚠️ **受影响** | 走 OpenAI→Claude 转换层 |
| `/v1/chat/completions` → AWS Bedrock(Claude) | ⚠️ **受影响** | 同上 |
| `/v1/messages` → Claude 渠道 | ❌ 正常 | `ConvertClaudeRequest` 原样透传 |

---

## 7. 修复方案

### Step 1：解析层读取 `cache_control`

文件：`dto/openai_request.go`，在 `ParseContent()` 的 `ContentTypeText` 分支中：

```go
case ContentTypeText:
    if text, ok := contentItem["text"].(string); ok {
        var cacheControl json.RawMessage
        if cc, ok := contentItem["cache_control"]; ok {
            if ccBytes, err := json.Marshal(cc); err == nil {
                cacheControl = ccBytes
            }
        }
        contentList = append(contentList, MediaContent{
            Type:         ContentTypeText,
            Text:         text,
            CacheControl: cacheControl,
        })
    }
```

> 注意：根据项目规范（Rule 1），解析 JSON 后重新 marshal 时应使用 `common.Marshal()`。

### Step 2：转换层透传 `CacheControl`

文件：`relay/channel/claude/relay-claude.go`

**system 消息分支修改：**
```go
systemMessages = append(systemMessages, dto.ClaudeMediaMessage{
    Type:         "text",
    Text:         common.GetPointer[string](ctx.Text),
    CacheControl: ctx.CacheControl, // 新增
})
```

**普通消息 text 分支修改：**
```go
claudeMediaMessages = append(claudeMediaMessages, dto.ClaudeMediaMessage{
    Type:         "text",
    Text:         common.GetPointer[string](mediaMessage.Text),
    CacheControl: mediaMessage.CacheControl, // 新增
})
```

---

## 8. 备注

- 这是一个**典型的协议转换层数据透传遗漏**，与你最近修复的 URL 版本前缀拼接问题属于完全不同的 bug 模式，但同样位于 relay 层。
- `Claude→OpenAI` 反向转换（`service/convert.go` L115、L156）已经正确透传了 `CacheControl`，说明字段定义没有问题，只是正向转换时遗漏了。
- 修复后建议补充一个单元测试：构建一个带 `cache_control` 的 OpenAI 请求，经过 `RequestOpenAI2ClaudeMessage()` 后断言输出 Claude 请求体中保留了 `cache_control`。
