# Changelog for bulaya/new-api

本文档记录了 [bulaya/new-api](https://github.com/bulaya/new-api) fork 相对于上游 [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) 的改动。

> **注意**: 本 CHANGELOG 仅记录 fork 的个性化改动，便于后续与上游同步合并。

---

## 新增功能：手机验证码登录

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

---

## 更新记录

| 日期 | 上游 Commit | 同步状态 |
|------|-------------|----------|
| 2026-04-02 | d22f889e | 已同步 |

---

## 参考链接

- 上游仓库: https://github.com/Calcium-Ion/new-api
- Fork 仓库: https://github.com/bulaya/new-api
- 阿里云号码认证服务: https://dypns.aliyun.com/
