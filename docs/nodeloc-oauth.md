# NodeLoc OAuth2 登录集成说明

本项目已成功集成 NodeLoc OAuth2 登录功能，参考了 Linux DO 的实现和 NodeLoc 官方文档。

## 实现的功能

1. **用户登录**：使用 NodeLoc 账户登录系统
2. **用户注册**：首次登录时自动创建账户（需满足信任等级要求）
3. **账户绑定**：已登录用户可以绑定 NodeLoc 账户

## 配置步骤

### 1. 创建 NodeLoc OAuth 应用

访问 NodeLoc 论坛创建 OAuth 应用：
```
https://www.nodeloc.com/oauth-provider/applications
```

记录以下信息：
- **Client ID**: 应用的唯一标识符
- **Client Secret**: 应用密钥（请妥善保管）
- **Redirect URI**: 设置为 `http(s)://your-domain.com/api/oauth/nodeloc`

### 2. 配置环境变量

在 `.env` 文件或环境变量中添加以下配置：

```bash
# NodeLoc OAuth 端点（可选，使用默认值）
NODELOC_TOKEN_ENDPOINT=https://www.nodeloc.com/oauth-provider/token
NODELOC_USER_ENDPOINT=https://www.nodeloc.com/oauth-provider/userinfo
```

### 3. 在系统中启用 NodeLoc OAuth

在系统设置中配置以下选项：
- `NodeLocClientId`: 您的 Client ID
- `NodeLocClientSecret`: 您的 Client Secret
- `NodeLocMinimumTrustLevel`: 最低信任等级（默认为 0）
- `NodeLocOAuthEnabled`: 设置为 `true` 启用功能

## 技术实现

### 新增文件
- `controller/nodeloc.go`: NodeLoc OAuth2 控制器

### 修改文件
- `model/user.go`: 添加 `NodeLocId` 字段和相关方法
- `common/constants.go`: 添加 NodeLoc 相关常量
- `controller/option.go`: 添加 NodeLoc OAuth 配置验证
- `router/api-router.go`: 添加 `/api/oauth/nodeloc` 路由
- `controller/user.go`: 在用户信息中返回 `nodeloc_id`
- `.env.example`: 添加 NodeLoc 配置示例

### OAuth2 流程

1. 用户点击"使用 NodeLoc 登录"
2. 重定向到 NodeLoc 授权页面：
   ```
   https://www.nodeloc.com/oauth-provider/authorize?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=YOUR_REDIRECT_URI&
     response_type=code&
     scope=openid%20profile&
     state=RANDOM_STATE
   ```
3. 用户授权后，NodeLoc 重定向回 `/api/oauth/nodeloc?code=xxx&state=xxx`
4. 系统使用 code 交换 access_token
5. 使用 access_token 获取用户信息
6. 根据用户信息登录或注册账户

### 返回的用户信息

```json
{
  "id": 123,
  "username": "user1",
  "name": "user1",
  "avatar_url": "https://www.nodeloc.com/avatar.png",
  "trust_level": 2,
  "email": "user1@example.com"
}
```

## 安全特性

- 使用 state 参数防止 CSRF 攻击
- 支持信任等级验证，确保用户质量
- 支持账户绑定而非强制覆盖
- 密钥信息不会通过 API 返回给前端

## 注意事项

1. **信任等级**: 如果设置了最低信任等级，新用户必须达到该等级才能注册
2. **账户绑定**: 一个 NodeLoc 账户只能绑定一个系统账户
3. **HTTPS**: 生产环境建议使用 HTTPS 协议
4. **邮箱权限**: 如果需要获取用户邮箱，需要在 NodeLoc 应用设置中申请 `email` scope 并等待管理员审核

## 数据库变化

需要在 `users` 表中添加新字段：
```sql
ALTER TABLE users ADD COLUMN nodeloc_id VARCHAR(255);
CREATE INDEX idx_users_nodeloc_id ON users(nodeloc_id);
```

## 参考文档

- NodeLoc OAuth 文档: https://docs.nodeloc.com/api-reference/introduction