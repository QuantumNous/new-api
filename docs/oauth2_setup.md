# OAuth2 服务器设置指南

## 概述

该 OAuth2 服务器实现基于 RFC 6749 标准，支持以下特性：

- **授权类型**: Client Credentials, Authorization Code + PKCE, Refresh Token
- **JWT 访问令牌**: 使用 RS256 签名
- **JWKS 端点**: 公钥自动发布和轮换
- **兼容性**: 与现有认证系统完全兼容

## 配置

### 1. 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# OAuth2 基础配置
OAUTH2_ENABLED=true
OAUTH2_ISSUER=https://your-domain.com
OAUTH2_ACCESS_TOKEN_TTL=10
OAUTH2_REFRESH_TOKEN_TTL=720

# JWT 签名配置
JWT_SIGNING_ALGORITHM=RS256
JWT_KEY_ID=oauth2-key-1
JWT_PRIVATE_KEY_FILE=/path/to/private-key.pem

# 授权类型（逗号分隔）
OAUTH2_ALLOWED_GRANT_TYPES=client_credentials,authorization_code,refresh_token

# 强制 PKCE
OAUTH2_REQUIRE_PKCE=true

# 自动创建用户
OAUTH2_AUTO_CREATE_USER=false
OAUTH2_DEFAULT_USER_ROLE=1
OAUTH2_DEFAULT_USER_GROUP=default
```

### 2. 数据库迁移

重启应用程序将自动创建 `oauth_clients` 表。

### 3. 创建第一个 OAuth2 客户端

通过管理员界面或 API 创建客户端：

```bash
curl -X POST http://localhost:8080/api/oauth_clients \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试服务",
    "client_type": "confidential",
    "grant_types": ["client_credentials"],
    "scopes": ["api:read", "api:write"],
    "description": "用于服务对服务认证的测试客户端"
  }'
```

## OAuth2 端点

### 标准端点

- **令牌端点**: `POST /api/oauth/token`
- **授权端点**: `GET /api/oauth/authorize`
- **JWKS 端点**: `GET /.well-known/jwks.json`
- **服务器信息**: `GET /.well-known/oauth-authorization-server`

### 管理端点

- **令牌内省**: `POST /api/oauth/introspect` (需要管理员权限)
- **令牌撤销**: `POST /api/oauth/revoke`

### 客户端管理端点

- **列出客户端**: `GET /api/oauth_clients`
- **创建客户端**: `POST /api/oauth_clients`
- **更新客户端**: `PUT /api/oauth_clients`
- **删除客户端**: `DELETE /api/oauth_clients/{id}`
- **重新生成密钥**: `POST /api/oauth_clients/{id}/regenerate_secret`

## 使用示例

### 1. Client Credentials 流程

```go
package main

import (
    "context"
    "golang.org/x/oauth2/clientcredentials"
)

func main() {
    cfg := clientcredentials.Config{
        ClientID:     "your_client_id",
        ClientSecret: "your_client_secret", 
        TokenURL:     "https://your-domain.com/api/oauth/token",
        Scopes:       []string{"api:read"},
    }
    
    client := cfg.Client(context.Background())
    resp, _ := client.Get("https://your-domain.com/api/protected")
    // 处理响应...
}
```

### 2. Authorization Code + PKCE 流程

```go
package main

import (
    "context"
    "golang.org/x/oauth2"
)

func main() {
    conf := oauth2.Config{
        ClientID:     "your_web_client_id",
        ClientSecret: "your_web_client_secret",
        RedirectURL:  "https://your-app.com/callback",
        Scopes:       []string{"api:read"},
        Endpoint: oauth2.Endpoint{
            AuthURL:  "https://your-domain.com/api/oauth/authorize",
            TokenURL: "https://your-domain.com/api/oauth/token",
        },
    }
    
    // 生成 PKCE 参数
    verifier := oauth2.GenerateVerifier()
    
    // 构建授权 URL
    url := conf.AuthCodeURL("state", oauth2.S256ChallengeOption(verifier))
    
    // 用户授权后，使用授权码交换令牌
    token, _ := conf.Exchange(context.Background(), code, oauth2.VerifierOption(verifier))
    
    // 使用令牌调用 API
    client := conf.Client(context.Background(), token)
    resp, _ := client.Get("https://your-domain.com/api/protected")
}
```

### 3. cURL 示例

```bash
# 获取访问令牌
curl -X POST https://your-domain.com/api/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "client_id:client_secret" \
  -d "grant_type=client_credentials&scope=api:read"

# 使用访问令牌调用 API
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  https://your-domain.com/api/status
```

## 安全建议

### 1. 密钥管理

- 使用强随机密钥生成器
- 定期轮换 RSA 密钥对
- 将私钥存储在安全位置
- 考虑使用 HSM 或密钥管理服务

### 2. 网络安全

- 强制使用 HTTPS
- 配置适当的 CORS 策略
- 实现速率限制
- 启用请求日志和监控

### 3. 客户端管理

- 定期审查客户端列表
- 撤销不再使用的客户端
- 监控客户端使用情况
- 为不同用途创建不同的客户端

### 4. Scope 和权限

- 实施最小权限原则
- 定期审查 scope 定义
- 为敏感操作创建特殊 scope
- 实现细粒度的权限控制

## 故障排除

### 常见问题

1. **"OAuth2 server is disabled"**
   - 确保 `OAUTH2_ENABLED=true`
   - 检查配置文件是否正确加载

2. **"invalid_client"**
   - 验证 client_id 和 client_secret 
   - 确保客户端状态为启用

3. **"invalid_grant"**
   - 检查授权类型是否被允许
   - 验证 PKCE 参数（如果启用）

4. **"invalid_scope"**
   - 确保请求的 scope 在客户端配置中
   - 检查 scope 格式（空格分隔）

### 调试

启用详细日志：

```env
GIN_MODE=debug
LOG_LEVEL=debug
```

检查 JWKS 端点：

```bash
curl https://your-domain.com/.well-known/jwks.json
```

验证令牌：

```bash
# 可以使用 https://jwt.io 解码和验证 JWT 令牌
```

## 生产部署

### 1. 负载均衡

- OAuth2 服务器是无状态的，支持水平扩展
- 确保所有实例使用相同的私钥
- 使用 Redis 作为令牌存储

### 2. 监控

- 监控令牌签发速率
- 跟踪客户端使用情况
- 设置异常告警

### 3. 备份

- 备份私钥文件
- 备份客户端配置数据
- 制定灾难恢复计划

### 4. 性能优化

- 启用 JWKS 缓存
- 使用连接池
- 优化数据库查询
- 考虑使用 CDN 分发 JWKS