---
name: zhidou-tool-spec-from-api
description: 输入一条现有 REST 接口路径,自动产出 Agent 工具的 JSON schema 和契约骨架
when_to_use: 加新工具时,从现有 API 快速生成工具定义
---

# Skill: zhidou-tool-spec-from-api

## 作用

知豆 Agent 的工具大多是对现有 REST API 的封装。本 Skill 可以从现有 API 自动生成工具的 JSON schema 和契约骨架,减少手写工作量。

## 输入

- **API 路径**(如 `POST /api/token/`)
- **API 描述**(可选,如"创建新的 API Token")

## 输出

1. **工具 JSON schema**(符合 OpenAI function calling 格式)
2. **工具契约骨架**(Go 代码,含函数签名 + 注释)

## 执行步骤

### 第 1 步:定位 API handler

根据 API 路径,在 `router/api-router.go` 里找到对应的 handler 函数。

**示例**:
```
输入:POST /api/token/
输出:controller.AddToken (router/api-router.go:273)
```

### 第 2 步:读取 handler 代码

读取 handler 函数的代码,提取:
- 请求参数(从 `c.ShouldBindJSON(&req)` 里的 struct 提取)
- 返回值(从 `c.JSON(200, ...)` 提取)
- 鉴权要求(从 middleware 提取,如 `UserAuth()` / `CriticalRateLimit()`)

### 第 3 步:生成 JSON schema

按 OpenAI function calling 格式生成:

```json
{
  "name": "create_token",
  "description": "创建新的 API Token",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Token 名称"
      },
      "remain_quota": {
        "type": "integer",
        "description": "剩余额度(可选,默认无限)"
      },
      "expired_time": {
        "type": "integer",
        "description": "过期时间戳(可选,默认永不过期)"
      }
    },
    "required": ["name"]
  }
}
```

### 第 4 步:生成契约骨架

生成 Go 函数签名 + 注释:

```go
// ToolCreateToken 创建新的 API Token
// 对应 API:POST /api/token/
// 鉴权:UserAuth()
// 敏感等级:中(需二次确认)
func ToolCreateToken(userId int, name string, remainQuota *int, expiredTime *int64) (map[string]interface{}, error) {
    // TODO:实现逻辑
    // 1. 调用 model.CreateToken(userId, name, ...)
    // 2. 返回 token_id 和 key(脱敏后的)
    return nil, nil
}
```

### 第 5 步:补充契约元数据

根据 API 的敏感程度,补充:
- `needs_confirmation`:是否需要二次确认(删除/支付类操作 = true)
- `max_per_minute`:速率限制(默认 10)
- `allowed_in_bootstrap`:破冰期是否允许调用(写操作 = false)

```go
// 契约元数据
var CreateTokenContract = ToolContract{
    Name:                "create_token",
    Description:         "创建新的 API Token",
    NeedsConfirmation:   false,
    MaxPerMinute:        10,
    AllowedInBootstrap:  false,
    Handler:             ToolCreateToken,
}
```

## 示例

### 输入

```
POST /api/token/
```

### 输出

#### JSON Schema

```json
{
  "name": "create_token",
  "description": "创建新的 API Token,用于调用知豆 AI 的 API",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Token 名称,用于标识这个 Token 的用途"
      },
      "remain_quota": {
        "type": "integer",
        "description": "剩余额度(单位:token),不填则无限额度"
      },
      "expired_time": {
        "type": "integer",
        "description": "过期时间戳(Unix timestamp),不填则永不过期"
      },
      "model_limits": {
        "type": "array",
        "items": {"type": "string"},
        "description": "允许调用的模型列表,不填则允许所有模型"
      }
    },
    "required": ["name"]
  }
}
```

#### 契约骨架

```go
// ToolCreateToken 创建新的 API Token
// 对应 API:POST /api/token/ (controller.AddToken)
// 鉴权:UserAuth()
// 敏感等级:中(创建资源,不需二次确认,但有速率限制)
func ToolCreateToken(userId int, name string, remainQuota *int, expiredTime *int64, modelLimits []string) (map[string]interface{}, error) {
    // 1. 构造 Token 对象
    token := &model.Token{
        UserId:       userId,
        Name:         name,
        Status:       1,
        RemainQuota:  remainQuota,
        ExpiredTime:  expiredTime,
        ModelLimits:  modelLimits,
    }
    
    // 2. 调用 model 层创建
    err := model.CreateToken(token)
    if err != nil {
        return nil, fmt.Errorf("创建 Token 失败:%w", err)
    }
    
    // 3. 返回结果(key 脱敏)
    return map[string]interface{}{
        "token_id": token.Id,
        "name":     token.Name,
        "key":      "sk-***" + token.Key[len(token.Key)-4:], // 只显示后 4 位
        "status":   "created",
    }, nil
}

// 契约元数据
var CreateTokenContract = ToolContract{
    Name:                "create_token",
    Description:         "创建新的 API Token",
    NeedsConfirmation:   false,
    MaxPerMinute:        10,
    AllowedInBootstrap:  false, // 破冰期不允许创建 Token
    Handler:             ToolCreateToken,
}
```

## 注意事项

1. **手动调整**:自动生成的 schema 可能不完美,需要人工审查和调整。
2. **敏感等级判断**:删除/支付类操作必须标记 `needs_confirmation=true`。
3. **脱敏规则**:返回值里的 Token key / 密码 / 邮箱必须脱敏。
4. **参数验证**:生成的代码里要加参数验证(如 name 不能为空、quota 不能为负)。

## 支持的 API 类型

| API 类型 | 是否支持 | 备注 |
|---|---|---|
| GET(查询) | ✅ | 自动生成只读工具 |
| POST(创建) | ✅ | 自动生成写工具,默认 `needs_confirmation=false` |
| PUT(更新) | ✅ | 自动生成写工具,默认 `needs_confirmation=false` |
| DELETE(删除) | ✅ | 自动生成写工具,**强制** `needs_confirmation=true` |
| 文件上传 | ❌ | 暂不支持,需手写 |
| WebSocket | ❌ | 暂不支持,需手写 |
