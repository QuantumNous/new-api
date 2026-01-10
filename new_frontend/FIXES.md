# 前端修复记录

## 修复日期
2026-01-04

## 修复的问题

### 1. 登录接口返回格式不匹配 ✅

**问题描述**:
- 前端期望登录响应包含 `token` 字段
- 后端实际返回不包含 `token`，只返回用户基本信息
- 导致前端无法获取 API 访问令牌

**修复方案**:
- 在 `useAuth.ts` 中修改登录流程，登录成功后调用 `GET /api/user/self/token` 获取访问令牌
- 在 `user.service.ts` 中添加 `getAccessToken` 方法

**修改文件**:
- `@/lib/api/services/user.service.ts` - 添加 `getAccessToken` 方法
- `@/hooks/useAuth.ts` - 修改登录成功回调，添加 token 获取逻辑

### 2. 字段命名不一致 ✅

**问题描述**:
- 后端使用下划线命名：`display_name`, `used_quota`, `request_count`
- 前端使用驼峰命名：`displayName`, `usedQuota`, `requestCount`
- 导致字段映射错误

**修复方案**:
- 创建字段映射工具 `mappers.ts`
- 提供后端到前端的字段转换函数
- 在登录流程中使用映射工具转换用户数据

**修改文件**:
- `@/lib/utils/mappers.ts` - 新建文件，包含字段映射工具
- `@/hooks/useAuth.ts` - 使用映射工具转换用户数据

### 3. API 客户端类型安全问题 ✅

**问题描述**:
- Axios 响应拦截器返回 `response.data`，导致类型推断错误
- 泛型参数无法正确传递

**修复方案**:
- 重构 API 客户端，使用类型安全的方法包装
- 确保泛型参数正确传递

**修改文件**:
- `@/lib/api/client.ts` - 重构 API 客户端，添加类型安全方法

### 4. 类型定义不完整 ✅

**问题描述**:
- 缺少 `AccessTokenResponse` 类型定义
- `LoginResponse` 类型定义与实际后端返回不匹配

**修复方案**:
- 更新 `LoginResponse` 类型，匹配后端实际返回格式
- 添加 `AccessTokenResponse` 类型定义

**修改文件**:
- `@/types/user.ts` - 更新和添加类型定义

## 修复后的登录流程

```
1. 用户提交登录表单
   ↓
2. 调用 POST /api/user/login
   ↓
3. 后端返回用户基本信息（不含 token）
   ↓
4. 前端使用映射工具转换字段格式
   ↓
5. 调用 GET /api/user/self/token 获取访问令牌
   ↓
6. 保存用户信息和 token 到 localStorage
   ↓
7. 跳转到控制台仪表板
```

## 需要注意的事项

### TypeScript 错误提示

IDE 可能会提示找不到 `@tanstack/react-query` 模块，这是正常的，因为：
1. 该依赖已在 `package.json` 中声明（版本 ^5.28.0）
2. 需要运行 `npm install` 安装依赖
3. 可能是 IDE 缓存问题，重启 IDE 或运行 `npm run type-check` 可解决

### 环境变量配置

确保创建 `.env` 文件并配置：
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 后端依赖

修复方案依赖后端提供以下接口：
- `POST /api/user/login` - 用户登录
- `GET /api/user/self/token` - 获取访问令牌

## 测试建议

1. **启动后端服务**
   ```bash
   cd c:\shirosoralumie648\new-api
   go run main.go
   ```

2. **安装前端依赖**
   ```bash
   cd c:\shirosoralumie648\new-api\new_frontend
   npm install
   ```

3. **启动前端服务**
   ```bash
   npm run dev
   ```

4. **测试登录流程**
   - 访问 `http://localhost:5173/auth/login`
   - 输入用户名密码
   - 检查浏览器控制台网络请求
   - 验证是否成功获取 token
   - 验证用户信息是否正确显示

## 文件变更清单

### 修改的文件
- `@/lib/api/services/user.service.ts` - 添加 token 获取方法
- `@/lib/api/client.ts` - 重构 API 客户端
- `@/hooks/useAuth.ts` - 修改登录流程
- `@/types/user.ts` - 更新类型定义

### 新建的文件
- `@/lib/utils/mappers.ts` - 字段映射工具
- `@/lib/api/api-client.ts` - 备份 API 客户端（可删除）

## 后续优化建议

1. **统一字段命名**: 考虑在后端添加 JSON 序列化配置，自动转换命名格式
2. **错误处理**: 完善错误处理逻辑，提供更好的用户反馈
3. **Token 刷新**: 实现 token 自动刷新机制
4. **类型安全**: 进一步完善 TypeScript 类型定义，减少 `any` 的使用
