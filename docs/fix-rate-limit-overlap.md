# 修复限流中间件作用范围重叠问题

## 问题描述

在修复前，`GlobalWebRateLimit` 中间件被注册在全局 `router.Use()` 上，导致它影响了所有路由，包括模型调用 API。

这意味着用户调用模型 API（如 `/v1/chat/completions`）时，会**同时受到两层限流**：

1. `GlobalWebRateLimit` - 基于 IP 的全局 Web 限流
2. `ModelRequestRateLimit` - 基于用户 ID 的模型请求限流

这种设计是不合理的，因为：

- 模型调用 API 已经有专门的 `ModelRequestRateLimit` 进行限流
- `GlobalWebRateLimit` 本意是保护 Web 静态资源，不应该影响 API 调用
- 双重限流会导致用户困惑，难以排查限流问题

## 问题根源

### 路由注册顺序 (router/main.go)

```go
func SetRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
    SetApiRouter(router)       // 1. /api/*
    SetDashboardRouter(router) // 2. /dashboard/*
    SetRelayRouter(router)     // 3. /v1/*, /mj/* 等
    SetVideoRouter(router)     // 4. /video/* 等
    SetWebRouter(router)       // 5. 静态文件（注册全局中间件）
}
```

### 问题代码 (router/web-router.go)

```go
func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
    router.Use(gzip.Gzip(gzip.DefaultCompression))
    router.Use(middleware.GlobalWebRateLimit())  // ⚠️ 注册在全局 router 上
    router.Use(middleware.Cache())
    router.Use(static.Serve("/", common.EmbedFolder(buildFS, "web/dist")))
    // ...
}
```

`router.Use()` 会将中间件应用到**所有路由**，而不仅仅是静态文件路由。

## 解决方案

修改 `GlobalWebRateLimit` 中间件，让它跳过 API 路径。

### 修改文件

`middleware/rate-limit.go`

### 修改内容

```go
// apiPathPrefixes 定义需要跳过 Web 限流的 API 路径前缀
var apiPathPrefixes = []string{
    "/v1",
    "/api",
    "/mj",
    "/suno",
    "/pg",
    "/video",
    "/kling",
    "/jimeng",
    "/dashboard",
}

func GlobalWebRateLimit() func(c *gin.Context) {
    if common.GlobalWebRateLimitEnable {
        limiter := rateLimitFactory(common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration, "GW")
        return func(c *gin.Context) {
            path := c.Request.URL.Path
            // 跳过 API 路径，避免与其他限流中间件重复
            for _, prefix := range apiPathPrefixes {
                if strings.HasPrefix(path, prefix) {
                    c.Next()
                    return
                }
            }
            limiter(c)
        }
    }
    return defNext
}
```

## 修复后的限流作用范围

| 中间件 | 作用范围 | 限制对象 |
|-------|---------|---------|
| `GlobalWebRateLimit` | 静态资源（排除 API 路径） | IP |
| `GlobalAPIRateLimit` | `/api/*` | IP |
| `ModelRequestRateLimit` | `/v1/*`, `/v1beta/*` | 用户 ID |
| `CriticalRateLimit` | 登录/注册等关键操作 | IP |

## 修复日期

2024-12-30
