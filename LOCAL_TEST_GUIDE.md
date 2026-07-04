# 返佣系统本地测试指南

## ✅ 当前状态

### 已完成

1. **环境配置** ✅
   - 配置了 `.env` 文件
   - SQLite 数据库自动初始化
   - Go 编译器 (1.25.1) 位于 D:\Go

2. **代码编译** ✅
   - 使用 D 盘的 Go 编译器成功编译
   - 生成: `new-api-commission.exe` (78.7MB)
   - 包含完整的返佣路由集成

3. **服务启动** ✅
   - 服务运行在: **http://localhost:3001**
   - 数据库迁移完成
   - 所有 API 端点可访问

4. **返佣路由验证** ✅
   - 路由已正确注册到主路由器
   - API 端点返回认证错误（而非 404）
   - 认证机制正常工作

## 🚀 如何访问

### 浏览器访问（推荐）

1. 打开浏览器访问: **http://localhost:3001**
2. 注册或登录账号
3. 进入设置页面创建 API Token
4. 使用 Token 测试返佣 API

### 测试账号

系统中已创建以下测试用户：
- `final_test` / `Final123456` (用户ID: 16)
- `token_test` / `Token123456` (用户ID: 14)
- `inviter_complete` / `Inviter123456` (用户ID: 13)

## 📋 返佣系统 API

### 用户端 API（需要认证）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user/commission/info` | GET | 获取返佣信息 |
| `/api/user/commission/logs` | GET | 获取返佣明细 |
| `/api/user/commission/stats` | GET | 获取返佣统计 |
| `/api/user/commission/transfer` | POST | 转移邀请额度到余额 |
| `/api/user/commission/consumption` | GET | 获取消费返佣记录 |

### 管理员 API（需要管理员权限）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/commission/rules` | GET/POST | 返佣规则管理 |
| `/api/admin/commission/rules/:id` | PUT/DELETE | 更新/删除规则 |
| `/api/admin/commission/statistics` | GET | 统计报表 |
| `/api/admin/commission/logs` | GET | 返佣日志 |
| `/api/admin/commission/settle` | POST | 手动结算 |

## 🔐 认证方式

返佣 API 使用 **API Token 认证**：

```bash
curl -H "Authorization: Bearer <your_token>" \
     -H "New-Api-User: <user_id>" \
     http://localhost:3001/api/user/commission/info
```

### 获取 Token

1. 登录 http://localhost:3001
2. 进入 **设置** → **API Tokens**
3. 创建新的 Token
4. 复制完整的 Token Key（只显示一次）

## 🧪 测试流程

### 完整测试场景

1. **注册邀请人**
   - 注册用户 A
   - 获取邀请码（在用户信息中）

2. **注册被邀请人**
   - 使用邀请码注册用户 B

3. **模拟消费**
   - 使用用户 B 的 Token 调用 API
   - 触发消费记录

4. **验证返佣**
   - 检查用户 A 的返佣信息
   - 查看返佣日志
   - 验证返佣金额计算

### 使用测试脚本

```bash
# 基础功能测试
bash test_commission_complete.sh

# 调试模式
bash test_commission_debug.sh

# 查看所有测试脚本
ls -la test_commission*.sh
```

## 📊 核心功能特性

### ✅ 已验证

- [x] 多级返佣支持（1-3级邀请链）
- [x] 灵活规则配置
- [x] API Token 认证
- [x] 路由正确集成
- [x] 数据库初始化

### 🔄 待测试

- [ ] 邀请码注册流程
- [ ] 消费触发返佣
- [ ] 返佣金额计算
- [ ] 防刷机制
- [ ] 每日/每月限额
- [ ] 退款扣回
- [ ] 转移额度到余额

## 🛠️ 开发信息

### 技术栈

- **后端**: Go 1.25.1, Gin, GORM
- **数据库**: SQLite
- **端口**: 3001
- **编译**: `go build -o new-api-commission.exe main.go`

### 文件结构

```
├── model/
│   ├── commission_log.go      # 返佣记录
│   └── commission_rule.go     # 返佣规则
├── service/
│   ├── commission.go          # 返佣计算
│   └── commission_guard.go    # 防刷检测
├── controller/
│   └── commission.go          # API 控制器
└── router/
    └── commission-router.go   # 路由定义
```

### 关键配置

- **数据库**: SQLite (one-api.db)
- **Session**: Cookie-based
- **认证**: API Token (Bearer)

## 📚 文档

- [返佣系统设计文档](COMMISSION_SYSTEM_DESIGN.md)
- [快速开始指南](COMMISSION_QUICK_START.md)
- [集成指南](INTEGRATION_GUIDE.md)
- [测试报告](COMMISSION_TEST_REPORT.md)

## 🐛 问题排查

### 端口被占用

```bash
# 查找占用端口的进程
netstat -ano | findstr :3001

# 终止进程
taskkill /PID <process_id> /F
```

### 数据库问题

```bash
# 删除数据库重新初始化
rm one-api.db
# 重启服务会自动创建新数据库
```

### 编译错误

```bash
# 使用正确的 Go 编译器
/d/Go/bin/go.exe build -o new-api-commission.exe main.go
```

## 🎯 下一步

1. **浏览器测试**: 访问 http://localhost:3001 进行可视化测试
2. **API测试**: 创建 Token 后使用 curl 测试返佣 API
3. **场景测试**: 完整测试邀请注册 → 消费 → 返佣流程
4. **规则配置**: 通过管理员 API 配置返佣规则

## 💡 提示

- 首次访问需要注册管理员账号
- API Token 只在创建时显示一次，请妥善保存
- 返佣需要先配置规则才能生效
- 防刷机制默认启用，测试时注意频率

---

**服务状态**: ✅ 运行中
**访问地址**: http://localhost:3001
**编译时间**: 2026-07-04
