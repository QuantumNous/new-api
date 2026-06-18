# new-api 输入安全拦截配置与 Codex 交接说明

本文档给 VPS 上运行的 Codex 使用，用于在 new-api 中实现本地输入安全审查。目标是：不依赖 OpenAI moderation，直接在网关侧拦截用户请求中的 cyber abuse、NSFW、隐私窃取、诈骗等明显不合规输入。

相关规则详见：`docs/input_safety_rules.md`。

## 1. 是否可以由 VPS 上的 Codex 直接完成

可以。该功能是纯 Go 后端改动，不需要外部 SaaS 权限，也不需要 OpenAI 审查模型。

VPS Codex 需要具备：

```text
仓库源码读写权限
Go 工具链
能运行目标 Go 测试
能编辑环境变量或 docker-compose 配置
```

不需要：

```text
OpenAI API Key
数据库迁移
前端改动
第三方模型部署
```

## 2. 目标行为

只审查用户可控输入：

```text
/v1/chat/completions       messages 中 role=user 的 content
/v1/completions            prompt
/v1/responses              input 中用户文本
/v1/images/generations     prompt
/v1/images/edits           multipart form 的 prompt
/v1/messages               Claude messages 中 role=user 的 content
/v1beta/models/*           Gemini contents 中 role=user 或空 role 的 parts[].text
/v1/models/*               Gemini contents 中 role=user 或空 role 的 parts[].text
```

不审查：

```text
system prompt
developer prompt
assistant 历史输出
tool 输出
平台内部拼接内容
模型响应内容
```

命中高风险规则后，统一阻断请求并返回 OpenAI 兼容错误。

## 3. 对外返回格式

建议 HTTP 状态码：`400`。

```json
{
  "error": {
    "message": "请求内容不符合输入安全规则，请修改 prompt 后重试。",
    "type": "invalid_request_error",
    "param": "messages[0].content",
    "code": "input_safety_blocked"
  }
}
```

说明：

```text
message: 固定通用提示，不暴露关键词
param: 被拦截的用户输入字段路径
code: 固定 input_safety_blocked
type: 使用 invalid_request_error，保持 OpenAI 兼容风格
```

不要对外返回：

```text
rule_id
命中关键词
score
正则表达式
内部分类细节
```

内部日志可以记录：

```text
request_id
user_id
ip_hash
endpoint
model
param
category
rule_id
score
action
request_hash
```

## 4. 推荐配置项

使用环境变量，避免新增数据库迁移。

```text
INPUT_REVIEW_ENABLED=false
INPUT_REVIEW_MODE=log
INPUT_REVIEW_BLOCK_SCORE=40
INPUT_REVIEW_REVIEW_SCORE=20
INPUT_REVIEW_MAX_CHARS=8000
INPUT_REVIEW_RETURN_MESSAGE=请求内容不符合输入安全规则，请修改 prompt 后重试。
```

配置含义：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `INPUT_REVIEW_ENABLED` | `false` | 是否启用输入安全审查 |
| `INPUT_REVIEW_MODE` | `log` | `log` 只记录不阻断；`block` 阻断高风险请求 |
| `INPUT_REVIEW_BLOCK_SCORE` | `40` | 达到该分数阻断 |
| `INPUT_REVIEW_REVIEW_SCORE` | `20` | 达到该分数记录为中风险 |
| `INPUT_REVIEW_MAX_CHARS` | `8000` | 单段输入最多审查字符数，超出按高风险处理或截断后审查 |
| `INPUT_REVIEW_RETURN_MESSAGE` | 中文默认提示 | 对外返回 message |

上线建议：

```text
第一阶段：INPUT_REVIEW_ENABLED=true, INPUT_REVIEW_MODE=log
第二阶段：观察误杀后切 INPUT_REVIEW_MODE=block
```

## 5. 推荐代码结构

新增文件：

```text
middleware/input_safety.go
middleware/input_safety_rules.go
middleware/input_safety_test.go
```

可选新增文件：

```text
middleware/input_safety_extract.go
```

不要新增前端文件。
不要新增数据库表。
不要修改规则文档中的项目保护信息。

## 6. 接入点

当前 relay 路由入口：`router/relay-router.go`。

现有链路：

```go
relayV1Router := router.Group("/v1")
relayV1Router.Use(middleware.RouteTag("relay"))
relayV1Router.Use(middleware.SystemPerformanceCheck())
relayV1Router.Use(middleware.TokenAuth())
relayV1Router.Use(middleware.ModelRequestRateLimit())

httpRouter := relayV1Router.Group("")
httpRouter.Use(middleware.Distribute())
```

建议把输入审查放在 `Distribute()` 之前：

```go
httpRouter := relayV1Router.Group("")
httpRouter.Use(middleware.InputSafetyReview())
httpRouter.Use(middleware.Distribute())
```

原因：

```text
先拦截，再分发渠道，避免为违规请求做渠道选择和上游准备
TokenAuth 已完成，可记录 user_id
ModelRequestRateLimit 已完成，可保留现有限流语义
common.GetRequestBody / common.UnmarshalBodyReusable 会缓存并复位请求体，后续 Distribute 和 Relay 仍可读取
```

注意：`/v1/realtime` 是 WebSocket，不在本次范围。

## 7. 请求体读取要求

必须复用项目现有工具：

```go
common.UnmarshalBodyReusable(c, &request)
common.ParseMultipartFormReusable(c)
```

不要直接使用：

```go
encoding/json.Unmarshal
json.NewDecoder
io.ReadAll(c.Request.Body) 后不复位
```

项目规则要求 JSON marshal/unmarshal 使用 `common/json.go` 包装函数。

## 8. 提取策略

### 8.1 OpenAI Chat Completions

最小结构：

```go
type inputSafetyOpenAIRequest struct {
    Messages []struct {
        Role    string `json:"role"`
        Content any    `json:"content"`
    } `json:"messages"`
    Prompt any `json:"prompt"`
    Input  any `json:"input"`
}
```

提取：

```text
messages[i].role == "user" -> content
prompt -> prompt
input -> input
```

Content 可能是：

```text
string
[]object，其中 type == "text" 的 text 字段
```

### 8.2 Responses API

`input` 可能是：

```text
string
array，包含 role/content
array，包含 type=input_text 的 text
```

只提取用户输入文本。

### 8.3 Images

JSON：

```text
prompt
```

multipart：

```text
form.Value["prompt"]
```

### 8.4 Claude

提取：

```text
messages[i].role == "user" 的 content
```

content 可能是 string 或 blocks。只取 text block。

### 8.5 Gemini

提取：

```text
contents[i].role == "user" 或 role == "" 的 parts[j].text
```

不提取：

```text
systemInstruction
functionCall
functionResponse
inlineData
```

## 9. 规则引擎要求

第一版用内置规则，不读取外部文件，降低部署复杂度。

建议结构：

```go
type inputSafetyRule struct {
    ID       string
    Category string
    Score    int
    Any      []string
    All      [][]string
}

type inputSafetyFinding struct {
    Param    string
    Category string
    RuleID   string
    Score    int
}
```

匹配方式：

```text
Any: 任一关键词命中即加分
All: 每个组合组都至少命中一个词才加分
```

例如：

```text
[窃取|盗取|steal|dump] + [cookie|token|密码|凭据]
```

强制 block 规则：

```text
NSFW_SEXUAL_MINORS_001
NSFW_NON_CONSENSUAL_001
CYBER_CREDENTIAL_THEFT_001
CYBER_MALWARE_001
CYBER_EVASION_001
CYBER_PHISHING_001
CYBER_PAYMENT_FRAUD_001
```

规则来源：`docs/input_safety_rules.md`。

## 10. 文本归一化

实现函数：

```go
func normalizeInputSafetyText(s string) string
```

至少处理：

```text
strings.ToLower
strings.TrimSpace
连续空白合并
移除零宽字符：\u200b、\u200c、\u200d、\ufeff
全角 ASCII 转半角
URL QueryUnescape 一次，失败则保留原文
```

不要做昂贵或不确定的深度解码。
不要递归 base64 解码。

## 11. 错误构造

项目已有：

```go
types.OpenAIError
```

字段：

```go
type OpenAIError struct {
    Message string          `json:"message"`
    Type    string          `json:"type"`
    Param   string          `json:"param"`
    Code    any             `json:"code"`
}
```

中间件里可直接返回：

```go
c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
    "error": types.OpenAIError{
        Message: inputSafetyReturnMessage(),
        Type:    "invalid_request_error",
        Param:   finding.Param,
        Code:    "input_safety_blocked",
    },
})
```

如果后续希望纳入 `types.ErrorCode`，可新增：

```go
ErrorCodeInputSafetyBlocked ErrorCode = "input_safety_blocked"
```

但第一版中间件直接返回即可，改动更小。

## 12. 日志要求

使用项目 logger。日志不要包含完整原文。

建议记录：

```text
input safety blocked param=messages[0].content category=cyber_abuse rule=CYBER_MALWARE_001 score=100 path=/v1/chat/completions
```

不要记录：

```text
完整 prompt
完整 token
完整 cookie
完整 URL query 中的密钥
```

如需要 request_hash，使用 SHA-256 对原始片段求 hash。

## 13. 测试要求

新增 `middleware/input_safety_test.go`。

必须覆盖：

1. `INPUT_REVIEW_ENABLED=false` 时放行。
2. `INPUT_REVIEW_MODE=log` 命中规则也放行。
3. Chat Completions 中 `role=user` 命中 malware 组合时 400。
4. Chat Completions 中 `system` 命中但 user 正常时放行。
5. `prompt` 命中 NSFW 图片生成规则时 400。
6. Claude user message 命中凭据窃取时 400。
7. Gemini user part 命中钓鱼规则时 400。
8. 返回体包含：
   - `error.message`
   - `error.type == "invalid_request_error"`
   - `error.param`
   - `error.code == "input_safety_blocked"`
9. 返回体不包含：
   - `rule_id`
   - `score`
   - 具体关键词

测试只跑新增或相关测试即可。

## 14. 验证命令

在仓库根目录执行：

```bash
go test ./middleware
```

如果改动触及 `router/relay-router.go`，再执行：

```bash
go test ./router ./middleware
```

最终建议执行：

```bash
go test ./relay/helper ./middleware
```

不要跑前端构建；本任务不涉及前端。

## 15. VPS 环境变量示例

Docker Compose 可添加：

```yaml
environment:
  - INPUT_REVIEW_ENABLED=true
  - INPUT_REVIEW_MODE=block
  - INPUT_REVIEW_BLOCK_SCORE=40
  - INPUT_REVIEW_REVIEW_SCORE=20
  - INPUT_REVIEW_MAX_CHARS=8000
  - INPUT_REVIEW_RETURN_MESSAGE=请求内容不符合输入安全规则，请修改 prompt 后重试。
```

灰度期建议：

```yaml
environment:
  - INPUT_REVIEW_ENABLED=true
  - INPUT_REVIEW_MODE=log
```

## 16. 给 VPS Codex 的执行提示词

可直接复制给服务器上的 Codex：

```text
你在 new-api 仓库中工作。请实现本地输入安全审查，不依赖 OpenAI moderation。

必须先阅读：
- AGENTS.md
- docs/input_safety_rules.md
- docs/input_safety_handoff.md

目标：
- 只审查用户输入字段：chat messages role=user content、prompt、responses input、image prompt、Claude role=user content、Gemini user contents parts text。
- 不审查 system/developer/assistant/tool/model output。
- 命中高风险 cyber abuse、NSFW、privacy、fraud 规则时，在 relay 前阻断。
- 返回 OpenAI 兼容错误：type=invalid_request_error, code=input_safety_blocked, param=被拦截字段路径, message=请求内容不符合输入安全规则，请修改 prompt 后重试。
- 不向用户返回 rule_id、score、关键词。

实现要求：
- 新增 middleware/input_safety.go、middleware/input_safety_rules.go、middleware/input_safety_test.go。
- 在 router/relay-router.go 中把 middleware.InputSafetyReview() 加到 httpRouter 的 Distribute() 之前。
- 使用 common.UnmarshalBodyReusable / common.ParseMultipartFormReusable 读取请求体，不能破坏后续读取。
- JSON 解析必须使用 common 包装函数，不要直接调用 encoding/json 的 Marshal/Unmarshal。
- 配置使用环境变量：INPUT_REVIEW_ENABLED、INPUT_REVIEW_MODE、INPUT_REVIEW_BLOCK_SCORE、INPUT_REVIEW_REVIEW_SCORE、INPUT_REVIEW_MAX_CHARS、INPUT_REVIEW_RETURN_MESSAGE。
- 默认 INPUT_REVIEW_ENABLED=false，避免未配置时改变现有行为。
- 日志不记录完整 prompt，只记录 param、category、rule_id、score、path。

测试：
- 添加 middleware/input_safety_test.go。
- 覆盖 disabled 放行、log 模式放行、block 模式拦截、system 命中不拦截、OpenAI/Claude/Gemini/Image 提取、错误返回不泄露规则细节。
- 运行 go test ./middleware。
- 如果修改 router，运行 go test ./router ./middleware。

不要修改前端。不要新增数据库迁移。不要提交 git，除非用户另行要求。
```

## 17. 完成标准

Codex 完成后应提供：

```text
修改文件列表
新增配置项
命中的测试用例
测试命令和结果
是否需要重启服务
```

服务端启用时，只需重启 new-api 进程或容器，使环境变量生效。
