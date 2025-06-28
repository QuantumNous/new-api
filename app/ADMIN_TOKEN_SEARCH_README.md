# 超级管理员Token查询功能

## 功能概述
新增了超级管理员级别的token管理接口，允许超级管理员根据提供的令牌进行精确查询。

## 实现的功能
- ✅ 超级管理员权限验证（仅RootAuth可访问）
- ✅ 根据token字符串精确查询
- ✅ 自动处理sk-前缀（支持带或不带前缀的查询）
- ✅ 返回token详细信息和所属用户信息
- ✅ 自动清理敏感信息（token key字段）
- ✅ 完整的错误处理

## API接口详情

### 接口地址
```
GET /api/admin/token/search
```

### 权限要求
- 超级管理员权限（RoleRootUser = 100）
- 需要提供有效的access token
- 需要在请求头中包含New-Api-User字段

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| token | string | 是 | 要查询的令牌，支持带或不带sk-前缀 |

### 请求头
```
Authorization: Bearer {access_token}
New-Api-User: {user_id}
Content-Type: application/json
```

### 响应格式

#### 成功响应
```json
{
  "success": true,
  "message": "",
  "data": {
    "token": {
      "id": 1,
      "user_id": 2,
      "key": "",  // 已清理
      "status": 1,
      "name": "测试令牌",
      "created_time": 1640995200,
      "accessed_time": 1640995200,
      "expired_time": -1,
      "remain_quota": 1000000,
      "unlimited_quota": false,
      "model_limits_enabled": false,
      "model_limits": "",
      "allow_ips": null,
      "used_quota": 0,
      "group": "default"
    },
    "user": {
      "id": 2,
      "username": "testuser",
      "display_name": "测试用户",
      "email": "test@example.com",
      "role": 1,
      "status": 1,
      "quota": 1000000,
      "used_quota": 50000,
      "request_count": 150,
      "aff_quota": 0,
      "aff_history_quota": 0,
      "group": "default"
    }
  }
}
```

#### 错误响应
```json
{
  "success": false,
  "message": "未找到该令牌: record not found"
}
```

## 使用示例

### curl命令示例
```bash
# 查询带sk-前缀的token
curl -X GET "http://localhost:3000/api/admin/token/search?token=sk-xxxxxxxxxxxxxx" \
  -H "Authorization: Bearer your-admin-access-token" \
  -H "New-Api-User: 1"

# 查询不带sk-前缀的token
curl -X GET "http://localhost:3000/api/admin/token/search?token=xxxxxxxxxxxxxx" \
  -H "Authorization: Bearer your-admin-access-token" \
  -H "New-Api-User: 1"
```

### 测试脚本
项目中提供了测试脚本 `test_admin_token_search.sh`：

```bash
# 使用方法
./test_admin_token_search.sh [BASE_URL] [ACCESS_TOKEN] [USER_ID] [TOKEN_TO_SEARCH]

# 示例
./test_admin_token_search.sh "http://localhost:3000" "your-access-token" "1" "sk-your-token-here"
```

## 代码变更

### 修改文件
1. **controller/token.go**
   - 添加了 `AdminSearchTokenByKey` 函数
   - 添加了 `strings` 包导入

2. **router/api-router.go**
   - 添加了 `adminTokenRoute` 路由组
   - 配置了超级管理员权限验证

## 安全特性
- 仅超级管理员可访问
- 返回数据中自动清理token key敏感信息
- 完整的权限验证链
- 错误信息不泄露系统内部细节

## 使用场景
- 管理员排查token相关问题
- 审计特定token的使用情况
- 查看token所属用户信息
- 系统维护和监控
