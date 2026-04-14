# Changelog for bulaya/new-api

本文档记录了 [bulaya/new-api](https://github.com/bulaya/new-api) fork 相对于上游 [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) 的改动。

> **注意**: 本 CHANGELOG 仅记录 fork 的个性化改动，便于后续与上游同步合并。

---

## 改动一览

| # | 功能 | 添加日期 | 状态 |
|---|------|----------|------|
| 1 | 手机验证码登录 | 2026-03-31 | 已完成 |
| 2 | 跨域 CORS 修复 | 2026-04-01 | 已完成 |
| 3 | 弹窗登录模式（OAuth-style）| 2026-04-01 | 已完成 |

---

## 1. 新增功能：手机验证码登录

### 功能概述

支持用户通过手机号 + 短信验证码方式登录系统，适用于个人开发者场景（无需企业资质即可使用阿里云号码认证服务）。

### 支持的短信服务商

| 服务商 | 说明 |
|--------|------|
| 阿里云短信 | 标准短信服务，需审核签名和模板 |
| 阿里云 PNVS | 号码认证服务，个人开发者可用，系统赠送签名和模板 |
| 腾讯云短信 | 标准短信服务 |

---

## 新增文件

### 后端

| 文件 | 说明 |
|------|------|
| `controller/sms_login.go` | 短信登录控制器，包含发送验证码和登录接口 |
| `middleware/sms_rate_limit.go` | 短信发送频率限制中间件 |
| `common/sms/sms.go` | SMS 发送接口定义和工厂方法 |
| `common/sms/aliyun.go` | 阿里云短信发送实现 |
| `common/sms/aliyun_pnvs.go` | 阿里云 PNVS（号码认证服务）短信发送实现 |
| `setting/system_setting/sms.go` | SMS 配置结构定义 |

### 前端

| 文件 | 说明 |
|------|------|
| `web/src/components/auth/SmsLoginForm.jsx` | 短信验证码登录表单组件 |

---

## 修改文件

### 后端

| 文件 | 改动说明 |
|------|----------|
| `router/api-router.go` | 新增路由：`POST /api/sms/send`、`POST /api/user/login/sms` |
| `model/user.go` | 新增 `Phone` 字段、`FillUserByPhone()`、`IsPhoneAlreadyTaken()` 方法 |
| `i18n/keys.go` | 新增短信登录相关国际化键（8 条） |
| `i18n/locales/zh-CN.yaml` | 新增中文翻译 |
| `i18n/locales/en.yaml` | 新增英文翻译 |
| `i18n/locales/zh-TW.yaml` | 新增繁体中文翻译 |

### 前端

| 文件 | 改动说明 |
|------|----------|
| `web/src/components/auth/LoginForm.jsx` | 添加短信登录入口 |
| `web/src/components/settings/SystemSetting.jsx` | 添加短信服务配置界面 |
| `web/src/i18n/locales/zh-CN.json` | 新增中文翻译 |
| `web/src/i18n/locales/en.json` | 新增英文翻译 |
| 其他语言文件 | 新增对应翻译 |

---

## 接口说明

### 1. 发送短信验证码

```
POST /api/sms/send?turnstile={token}
Content-Type: application/json

{
  "phone": "+8613800138000"
}
```

**响应：**
```json
{
  "success": true,
  "message": "验证码发送成功"
}
```

### 2. 短信验证码登录

```
POST /api/user/login/sms?turnstile={token}
Content-Type: application/json

{
  "phone": "+8613800138000",
  "code": "123456"
}
```

**响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "id": 1,
    "username": "sms_1",
    "display_name": "138****8000",
    "token": "sk-xxx"
  }
}
```

---

## 频率限制

| 限制类型 | 限制值 | 时间窗口 |
|----------|--------|----------|
| 单手机号 | 1 次 | 60 秒 |
| 单 IP | 5 次 | 1 小时 |

---

## 配置说明

系统设置中新增 SMS 配置项：

```json
{
  "sms": {
    "enabled": true,
    "provider": "aliyun_pnvs",
    "access_key_id": "您的 AccessKey ID",
    "access_key_secret": "您的 AccessKey Secret",
    "sign_name": "系统赠送签名",
    "template_code": "系统赠送模板CODE",
    "app_id": "腾讯云 AppId（腾讯云专用）",
    "scheme_code": "方案Code（阿里云PNVS可选）"
  }
}
```

---

## 用户模型变更

`users` 表新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `phone` | varchar(20) | 手机号，带索引 |

---

## 自动注册逻辑

当用户使用未注册的手机号登录时：

1. 检查系统是否允许注册（`RegisterEnabled`）
2. 自动创建用户，用户名格式：`sms_{userId}`
3. 显示名称：手机号脱敏（如 `138****8000`）
4. 生成随机密码
5. 支持邀请码（aff 参数）
6. 可配置是否生成默认 Token

---

## 与上游合并注意事项

当与上游 [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) 同步时，需特别注意：

1. **`model/user.go`** - 用户模型新增 `Phone` 字段，合并时保留
2. **`router/api-router.go`** - 新增短信登录路由，合并时保留
3. **数据库迁移** - 确保上游迁移不会删除 `phone` 字段
4. **`middleware/cors.go`** - CORS 中间件已重写，不再使用 `AllowAllOrigins`
5. **`web/src/components/auth/LoginForm.jsx`** - 含弹窗登录逻辑，合并时仔细 review
6. **`web/src/helpers/auth.jsx`** - `AuthRedirect` 已支持 popup 模式

---

## 2. CORS 跨域修复

### 背景

为支持 AionUi 商业化集成（独立域名跨域调用），原有 CORS 配置 `AllowAllOrigins=true + AllowCredentials=true` 不符合 CORS 规范，浏览器会拒绝。

### 改动

**文件**: `middleware/cors.go`

- 移除 `AllowAllOrigins: true`
- 改用 `AllowOriginFunc` 函数动态判断：
  - 允许 `localhost` 和 `127.0.0.1`（开发环境）
  - 允许所有 `https://` 来源（生产环境）
- 保持 `AllowCredentials: true` 以支持 cookie 跨域

### 与上游合并注意事项

如果上游修改了 CORS 配置，需手动 merge 我们的 `AllowOriginFunc` 实现。

---

## 3. 弹窗登录模式（Popup OAuth-style）

### 背景

为支持 AionUi 等第三方应用通过弹窗方式集成 new-api 登录，新增 popup 模式：第三方应用打开 new-api 登录页弹窗 → 用户登录 → new-api 通过 `postMessage` 回传 token → 关闭弹窗。

### 流程

```
1. AionUi 打开弹窗：
   https://new-api.example.com/login?mode=popup&callback_origin=https://aionui.example.com

2. 用户在弹窗中登录（支持密码/SMS/OAuth/2FA/Passkey/微信/Telegram 全部方式）

3. 登录成功后，前端：
   a. 调用 GET /api/user/token 获取 Access Token
   b. 调用 GET /api/token/ 获取 API Token 列表
      - 若无 Token，自动调用 POST /api/token/ 创建一个
   c. 调用 POST /api/token/{id}/key 获取 API Token key
   d. 通过 window.opener.postMessage 回传：
      { type: 'aionui-auth', accessToken, apiToken: 'sk-xxx', user: {...} }
   e. window.close() 关闭弹窗
```

### 修改的文件

| 文件 | 改动说明 |
|------|----------|
| `web/src/components/auth/LoginForm.jsx` | 检测 `mode=popup` 参数，所有登录方式（密码/2FA/Passkey/WeChat/Telegram）成功后调用 `handlePopupCallback` |
| `web/src/components/auth/SmsLoginForm.jsx` | 接收 `isPopupMode` 和 `onPopupCallback` props，SMS 登录成功后回调 |
| `web/src/helpers/auth.jsx` | `AuthRedirect` 在 popup 模式下不重定向到 /console |

### URL 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `mode` | 设为 `popup` 启用弹窗模式 | `popup` |
| `callback_origin` | 弹窗 postMessage 的目标 origin | `https://aionui.example.com` |

### postMessage 消息格式

```javascript
{
  type: 'aionui-auth',
  accessToken: '<access_token>',  // 用于调用 new-api 管理 API
  apiToken: 'sk-xxxxxxxxxxxx',    // 用于走 /v1/ 代理的 Bearer Token
  user: {
    id: 1,
    username: 'sms_1',
    display_name: '138****8000',
    role: 1,
    status: 1,
    group: 'default'
  }
}
```

### 安全说明

- 第三方应用接收 message 时**必须**校验 `event.origin` 等于 new-api 的 origin
- new-api 的 `callback_origin` 参数应限制白名单（当前未限制，建议生产环境加强）
- 推荐启用 `GENERATE_DEFAULT_TOKEN=true` 环境变量，确保新用户注册后自动有 API Token

### 与上游合并注意事项

`LoginForm.jsx` 改动较多，如果上游修改了登录流程，需仔细 merge：
- 保留 `isPopupMode` / `callbackOrigin` 状态变量
- 保留 `handlePopupCallback` 函数
- 保留所有登录成功路径中的 `if (isPopupMode)` 分支

---

## 更新记录

| 日期 | 改动 | 上游同步状态 |
|------|------|--------------|
| 2026-03-31 | 新增手机验证码登录 | 基于 d22f889e |
| 2026-04-01 | CORS 修复 + 弹窗登录模式 | 待同步 |

---

## 参考链接

- 上游仓库: https://github.com/Calcium-Ion/new-api
- Fork 仓库: https://github.com/bulaya/new-api
- 阿里云号码认证服务: https://dypns.aliyun.com/
