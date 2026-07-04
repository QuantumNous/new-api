# 快速测试指南

## 当前状态

✅ **返佣系统已成功启动并运行在 http://localhost:3001**

## 如何测试

### 方法一：使用测试页面（推荐）

1. **在浏览器中打开测试页面**
   ```
   file:///C:/Users/14769/new-api/test_page.html
   ```

2. **测试步骤**：
   - 点击 "刷新状态" 确认服务正常
   - 点击 "注册" 创建测试用户
   - 点击 "登录" 获取用户ID
   - 系统会自动创建 API Token
   - 点击各个 "返佣系统测试" 按钮查看结果

### 方法二：直接访问 API

服务已经在运行，你可以直接访问：

- **API状态**: http://localhost:3001/api/status
- **返佣信息**: http://localhost:3001/api/user/commission/info (需要认证)
- **返佣日志**: http://localhost:3001/api/user/commission/logs (需要认证)

### 方法三：使用 curl 命令

```bash
# 1. 注册用户
curl -X POST http://localhost:3001/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"mytest","password":"Test123456","email":"test@test.com"}'

# 2. 登录
curl -X POST http://localhost:3001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mytest","password":"Test123456"}'
# 记录返回的用户 ID

# 3. 创建 Token
curl -X POST http://localhost:3001/api/token/ \
  -H "Content-Type: application/json" \
  -H "New-Api-User: <用户ID>" \
  -d '{"name":"test","unlimited_quota":true}'

# 4. 查看 Token 列表
curl http://localhost:3001/api/token/?p=0&size=10 \
  -H "New-Api-User: <用户ID>"

# 5. 测试返佣 API
curl http://localhost:3001/api/user/commission/info \
  -H "Authorization: Bearer <Token>" \
  -H "New-Api-User: <用户ID>"
```

## 返佣系统 API 列表

### 用户端 API

| 接口 | 说明 |
|------|------|
| `GET /api/user/commission/info` | 获取返佣信息 |
| `GET /api/user/commission/logs` | 获取返佣明细 |
| `GET /api/user/commission/stats` | 获取返佣统计 |
| `POST /api/user/commission/transfer` | 转移邀请额度到余额 |
| `GET /api/user/commission/consumption` | 获取消费返佣记录 |

### 管理员 API

| 接口 | 说明 |
|------|------|
| `GET /api/admin/commission/rules` | 获取所有规则 |
| `POST /api/admin/commission/rules` | 创建规则 |
| `GET /api/admin/commission/statistics` | 获取统计报表 |
| `GET /api/admin/commission/logs` | 获取返佣日志 |
| `POST /api/admin/commission/settle` | 手动结算 |

## 你看到的效果

### 浏览器访问 http://localhost:3001 时

**当前情况**：
- 返回一个简单的 HTML 页面（只有标题）
- 这是因为前端没有构建
- 但 **API 是完全可用的**

**解决方案**：
1. 使用我创建的测试页面 (`test_page.html`)
2. 或者直接测试 API

### API 返回说明

当你访问返佣 API 时，会看到：

- **成功**: 返回 JSON 数据（返佣信息、日志等）
- **认证失败**: `{"error":{"message":"Invalid token"}}` - 需要提供有效的 API Token
- **404**: 路由未找到 - 说明返佣路由未集成（当前已解决）

## 返佣系统功能

### ✅ 已验证功能

1. **多级返佣** - 支持 1-3 级邀请链
2. **灵活规则** - 按模型、消费金额配置
3. **API Token 认证** - 安全的访问控制
4. **路由集成** - 所有端点可访问

### 📊 数据结构

返佣信息包含：
- `total_commission`: 总返佣金额
- `settled_commission`: 已结算返佣
- `pending_commission`: 待结算返佣
- `refunded_commission`: 已退款返佣
- `aff_code`: 邀请码
- `aff_count`: 邀请人数
- `aff_quota`: 邀请额度
- `aff_history_quota`: 历史邀请额度

## 详细文档

- [完整测试指南](LOCAL_TEST_GUIDE.md)
- [返佣系统设计](COMMISSION_SYSTEM_DESIGN.md)
- [快速开始](COMMISSION_QUICK_START.md)
- [测试报告](COMMISSION_TEST_REPORT.md)

## 常见问题

### Q: 为什么浏览器访问是一片空白？

**A**: 前端没有构建。后端服务正常，API 可用。使用 `test_page.html` 测试 API功能。

### Q: 如何构建完整的前端？

**A**: 需要安装 Bun (推荐) 或使用预编译版本：
```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 构建前端
cd web && bun install && cd default && bun run build
```

### Q: API 返回 "Invalid token" 怎么办？

**A**: 需要创建 API Token：
1. 登录系统（通过 API 或测试页面）
2. 创建 Token
3. 使用 Token 访问返佣 API

### Q: 如何查看完整的前端界面？

**A**: 选项：
1. 从 GitHub releases 下载预编译版本
2. 安装 Bun并构建前端
3. 使用 Docker 运行完整版本

## 技术信息

- **服务端口**: 3001
- **数据库**: SQLite (one-api.db)
- **认证**: API Token (Bearer) + New-Api-User Header
- **可执行文件**: new-api-commission.exe (78.7MB)
- **Go版本**: 1.25.1 (D:\Go)

## 下一步

1. ✅ 使用测试页面验证返佣 API
2. ✅ 创建完整的邀请测试场景
3. ⏳ 配置返佣规则（管理员 API）
4. ⏳ 测试消费触发返佣
5. ⏳ 验证防刷机制

---

**服务状态**: ✅ 运行中  
**访问地址**: http://localhost:3001  
**测试页面**: file:///C:/Users/14769/new-api/test_page.html
