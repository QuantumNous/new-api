# 微信扫码登录功能规划

更新日期：2026-06-14

适用分支：`feature/native-affiliate-minimal`

参考资料：`C:/Users/LJP/Downloads/微信扫码登录.md`

## 1. 背景与目标

当前仓库已经具备微信验证码登录/绑定的基础能力：

- 后端入口：`GET /api/oauth/wechat?code=...`
- 绑定入口：`POST /api/oauth/wechat/bind`
- 外部微信服务查询：`GET {WeChatServerAddress}/api/wechat/user?code=...`
- 用户绑定字段：`users.wechat_id`
- 系统配置：`WeChatAuthEnabled`、`WeChatServerAddress`、`WeChatServerToken`、`WeChatAccountQRCodeImageURL`
- 邀请归因：微信首次注册已经走 `AffiliateRegisterMethodWeChat`，可继承分销邀请码和初始额度逻辑。

参考文档希望新增“真正的微信扫码登录”：

1. new-api 向外部微信服务申请登录二维码。
2. 前端展示二维码并轮询登录状态。
3. 微信用户扫码确认后，外部微信服务返回稳定 openid。
4. new-api 根据 openid 登录已绑定用户，或在允许注册时创建新用户。

目标是复用现有微信登录、用户创建、邀请归因和 session 逻辑，不另造一套账户体系。

## 2. 当前能力与缺口

### 2.1 已有能力

后端 `controller/wechat.go` 已有：

- `getWeChatIdByCode(code)`：用验证码向外部微信服务换取 openid。
- `WeChatAuth(c)`：通过 openid 登录或注册用户。
- `WeChatBind(c)`：登录用户绑定微信 openid。

前端 default/classic 已有：

- 登录/注册页显示微信入口。
- 当前模式是“扫码关注公众号，输入验证码”。
- default 前端已有 `wechatLoginByCode(code)` API 封装。
- classic 前端已有对应登录、注册、个人设置绑定入口。

### 2.2 主要缺口

- 没有创建登录二维码的 new-api API。
- 没有在 new-api 侧代理二维码图片和 no-cache 防缓存。
- 没有轮询扫码状态的 new-api API。
- 没有 login_token 的本地 TTL、幂等、过期、风控和审计。
- 前端微信弹窗仍要求用户手输验证码，不是扫码后自动登录。
- 外部微信服务返回的 `auth_code` 尚未定义在 new-api 侧的用途。

## 3. 设计原则

- 外部微信服务 token 只留在服务端，浏览器永远不接触 `WeChatServerToken`。
- 浏览器只访问 new-api 的 `/api/oauth/wechat/*`，不直连外部微信服务。
- 扫码登录成功后由 new-api 直接设置 session cookie，不让前端自行处理 openid。
- 继续复用 `users.wechat_id`，同一微信号的 openid 必须和验证码登录一致。
- 新用户注册继续复用现有微信注册和分销邀请归因链路。
- 二维码和登录状态全部 no-store，避免浏览器或 CDN 复用旧二维码。
- 所有临时 token 必须有 TTL、哈希存储、限流和过期清理。
- 不记录完整 login_token、完整外部 auth_code、完整 openid 到普通日志。

## 4. API 规划

### 4.1 创建登录二维码

前端调用：

```http
POST /api/oauth/wechat/login/qrcode
```

请求体：

```json
{
  "aff_code": "optional_affiliate_invite_code"
}
```

说明：

- `aff_code` 可选。前端可从 localStorage 或 URL invite 参数传入，用于扫码注册时延续邀请归因。
- 未登录用户可调用，但需要走 `middleware.CriticalRateLimit()`。
- 如果 `WeChatAuthEnabled=false` 或 `WeChatServerAddress` 为空，返回业务失败。

new-api 调用外部微信服务：

```http
POST {WeChatServerAddress}/api/wechat/create_login_qrcode
Authorization: Bearer <server token>
```

外部服务参考返回：

```json
{
  "success": true,
  "data": {
    "scene_id": "login_xxxxxxxxxxxx",
    "qrcode_url": "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=xxxx",
    "login_token": "abc123",
    "expire_seconds": 600
  },
  "message": "二维码创建成功"
}
```

new-api 返回给前端：

```json
{
  "success": true,
  "data": {
    "scene_id": "login_xxxxxxxxxxxx",
    "login_token": "abc123",
    "qrcode_image_url": "/api/oauth/wechat/login/qrcode/image?login_token=abc123&v=1718350000000",
    "expire_seconds": 180,
    "poll_interval_seconds": 2
  },
  "message": ""
}
```

注意：

- 对前端建议 TTL 使用 180 秒，和参考文档的“三分钟内有效”一致；如果外部返回 600 秒，则 new-api 仍可按 `min(external_expire, 180)` 控制本地有效期。
- `qrcode_url` 不直接返回给前端，避免浏览器/CDN 直接缓存外部二维码。
- `qrcode_image_url` 由 new-api 代理，带随机 `v` 参数，并设置 `Cache-Control: no-store`。

### 4.2 获取二维码图片

前端使用：

```http
GET /api/oauth/wechat/login/qrcode/image?login_token=abc123&v=...
```

new-api 行为：

- 校验 login_token 存在且未过期。
- 优先返回服务端缓存的二维码图片。
- 缓存未命中时从外部 `qrcode_url` 下载。
- 响应 `Content-Type` 应跟随图片实际类型，通常为 `image/jpeg` 或 `image/png`。
- 响应头必须包含 `Cache-Control: no-store, no-cache, max-age=0`。
- 超时后自动清理图片缓存。

### 4.3 查询登录状态

前端轮询：

```http
GET /api/oauth/wechat/login/status?login_token=abc123
```

new-api 调用外部微信服务：

```http
GET {WeChatServerAddress}/api/wechat/login_status?login_token=abc123
Authorization: Bearer <server token>
```

外部服务参考成功返回：

```json
{
  "success": true,
  "data": {
    "status": "success",
    "wechat_user": {
      "openid": "ojhXq3BY6WdBg2VwRVC-OjY9tOdg"
    },
    "auth_code": "xxxxxxxx"
  },
  "message": "查询成功"
}
```

new-api 对前端返回建议：

扫码未完成：

```json
{
  "success": true,
  "data": {
    "status": "pending"
  },
  "message": ""
}
```

扫码成功且登录完成：

```json
{
  "success": true,
  "data": {
    "status": "success",
    "user": {
      "id": 32,
      "username": "ChengyuWang0807",
      "display_name": "ChengyuWang0807",
      "role": 1,
      "status": 1,
      "group": "default"
    }
  },
  "message": ""
}
```

过期或无效：

```json
{
  "success": false,
  "data": {
    "status": "expired"
  },
  "message": "登录令牌无效或已过期"
}
```

说明：

- 外部服务返回的 `auth_code` 不建议透传给前端。new-api 应在轮询成功的同一个响应里完成 session 设置。
- 如果确实需要兼容外部 `auth_code`，也应只作为服务端审计字段或调试字段，默认不返回。

## 5. 后端实现规划

### 5.1 文件边界

建议新增或调整：

- `controller/wechat.go`：保留现有验证码登录，新增扫码 API handler。
- `service/wechat_login.go`：封装外部微信服务调用、本地 session 状态、二维码下载缓存。
- `model/wechat_login.go`：如采用 DB sidecar，定义扫码登录会话表。
- `controller/wechat_test.go`：覆盖 handler 和外部服务 mock。
- `service/wechat_login_test.go`：覆盖 TTL、幂等、外部失败和二维码下载。

### 5.2 本地状态存储

推荐使用 sidecar 表或 Redis。考虑本项目已经有 PostgreSQL/Redis dev compose，建议实现顺序为：

1. MVP：使用 Redis 或内存 cache 存储二维码图片与轮询状态，TTL 到期自动清理。
2. 可审计版本：新增 `wechat_login_sessions` sidecar 表，只保存 token hash、scene_id、状态、过期时间、invite code、request id 和脱敏错误。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `scene_id` | 外部微信登录场景 |
| `login_token_hash` | login_token 的哈希，不存明文 |
| `status` | pending / success / expired / failed / consumed |
| `wechat_id` | 成功后记录 openid，可按现有 `users.wechat_id` 口径保存 |
| `invite_code` | 创建二维码时带入的邀请参数 |
| `created_ip_hash` | 创建请求 IP 哈希 |
| `created_user_agent_hash` | UA 哈希 |
| `expires_at` | 本地过期时间 |
| `consumed_at` | 成功登录并设置 session 的时间 |
| `last_polled_at` | 最近轮询时间 |
| `failure_reason` | 脱敏失败原因 |

login_token 明文只在响应前端和请求外部服务时使用，不写入 DB 日志。

### 5.3 登录或注册复用逻辑

建议把 `WeChatAuth` 中“按 wechat_id 查用户或创建用户”的逻辑抽成内部函数：

```go
func loginOrCreateUserByWeChatId(c *gin.Context, wechatId string, input wechatAuthInput) (*model.User, error)
```

复用范围：

- 旧验证码登录：`GET /api/oauth/wechat?code=...`
- 新扫码登录状态成功：`GET /api/oauth/wechat/login/status?...`

行为要求：

- openid 已绑定：加载用户并检查状态。
- openid 未绑定且允许注册：创建 `wechat_<next_id>` 用户，写入 `users.wechat_id`。
- openid 未绑定且关闭注册：返回“管理员关闭了新用户注册”。
- 新用户创建时继续走 `resolveAffiliateInviteContextForRegistration` 和 `recordAffiliateInviteAttributionForRegistration`。
- 禁用用户不允许登录。

### 5.4 2FA 策略

当前 `WeChatAuth` 直接调用 `setupLogin(&user, c)`，不会触发 `setupLoginWithOptionalTwoFA`。扫码登录可以有两种策略：

- 兼容策略：与现有微信验证码登录保持一致，扫码成功后直接登录。
- 安全策略：改为 `setupLoginWithOptionalTwoFA`，让已开启 2FA 的用户扫码后仍需二次验证。

建议先在规划和评审中确认。如果没有强兼容要求，推荐安全策略，并同步评估是否也要把旧 `WeChatAuth` 改为安全策略。

### 5.5 Header 与 token 处理

参考文档要求外部请求带：

```http
Authorization: Bearer xxxx
```

当前代码直接：

```go
req.Header.Set("Authorization", common.WeChatServerToken)
```

建议新增 helper：

```go
func wechatAuthorizationHeader(token string) string
```

规则：

- 如果配置值已经以 `Bearer ` 开头，则原样使用。
- 否则自动补 `Bearer `。
- 日志中不输出 token。

## 6. 前端实现规划

### 6.1 default 前端

涉及文件：

- `web/default/src/features/auth/api.ts`
- `web/default/src/features/auth/sign-in/components/user-auth-form.tsx`
- `web/default/src/features/auth/sign-up/components/sign-up-form.tsx`
- `web/default/src/i18n/locales/*.json`

交互：

- 点击“使用 微信 继续”后调用 `POST /api/oauth/wechat/login/qrcode`。
- 弹窗展示二维码和倒计时。
- 每 2 秒轮询 `/api/oauth/wechat/login/status`。
- status=pending 时继续轮询。
- status=success 时停止轮询，调用现有 `handleLoginSuccess`。
- status=expired/failed 时展示重新获取二维码按钮。
- 保留“使用验证码登录”作为 fallback，至少在首版不删除旧能力。

### 6.2 classic 前端

涉及文件：

- `web/classic/src/components/auth/LoginForm.jsx`
- `web/classic/src/components/auth/RegisterForm.jsx`
- `web/classic/src/components/settings/PersonalSetting.jsx`
- `web/classic/src/i18n/locales/*.json`

要求：

- classic 保持现有 Semi Design 风格。
- 不把 default 的 Tailwind 组件直接复制到 classic。
- 登录和注册两处都要支持扫码自动登录。
- 个人设置绑定微信可以继续使用验证码绑定，后续再规划扫码绑定。

## 7. 安全、风控与缓存

必须实现：

- 创建二维码和轮询状态都走 `CriticalRateLimit`。
- login_token 长度和格式校验。
- 本地 TTL 到期后不再查询外部服务。
- 轮询频率建议前端 2 秒，服务端对同 token 可做最小间隔保护。
- 二维码图片响应必须 no-store。
- 外部 HTTP client 超时建议 5 秒。
- 外部失败返回业务错误，不暴露外部响应原文中的敏感字段。
- 成功登录后将本地状态标记 consumed，重复轮询不重复创建用户、不重复写邀请归因。
- 日志只记录 scene_id、状态、耗时、脱敏 openid 或 hash，不记录 token 和 auth_code。

建议实现：

- 对同 IP 创建二维码加短周期频控。
- 对 expired/failed token 返回统一提示，避免枚举 token。
- 对 openid 绑定冲突使用现有 `IsWeChatIdAlreadyTaken` 逻辑。
- 对新用户注册链路保留 Turnstile 争议：扫码登录天然依赖微信，但如站点要求强 Turnstile，需要单独产品决策。

## 8. 测试计划

后端单元/集成测试：

- 创建二维码成功，返回本地 qrcode image URL。
- 外部 create 失败时返回业务错误。
- token 无效、过期、重复消费。
- 轮询 pending 不登录。
- 轮询 success 且 openid 已绑定，设置 session。
- 轮询 success 且 openid 未绑定，注册开启时创建用户。
- 注册关闭时不创建用户。
- 禁用用户不能登录。
- 新建用户时分销 invite code 被记录。
- Authorization header 自动补 Bearer。
- 二维码图片 no-store header。

前端测试/验收：

- default 登录页扫码成功跳转。
- default 注册页扫码成功跳转。
- classic 登录页扫码成功跳转。
- classic 注册页扫码成功跳转。
- 二维码过期后可重新获取。
- 轮询中关闭弹窗会停止请求。
- 中英文切换不出现未翻译文案。

本地 smoke：

```bash
curl -i -X POST http://127.0.0.1:3000/api/oauth/wechat/login/qrcode
curl -i "http://127.0.0.1:3000/api/oauth/wechat/login/status?login_token=..."
```

真实联调需要可用的外部微信服务和公众号扫码能力；没有外部服务时只能用 httptest/mock 完成自动化验证。

## 9. 分阶段落地

### Phase 1：后端最小闭环

- 封装外部微信扫码服务 client。
- 新增 create qrcode 和 status API。
- 实现本地 TTL、状态和 no-store。
- 复用现有微信登录/注册逻辑。
- 补后端测试。

### Phase 2：default/classic 前端

- default 登录/注册弹窗改为扫码自动登录。
- classic 登录/注册弹窗改为扫码自动登录。
- 保留验证码登录 fallback。
- 补 i18n。

### Phase 3：审计与运维

- 增加扫码登录事件审计或安全日志。
- 在系统设置中补充“扫码登录服务状态/最近错误”只读信息。
- 评估 2FA 策略是否同步到旧微信验证码登录。

## 10. 待确认问题

- 外部 `/api/wechat/create_login_qrcode` 是否必须无请求体，还是需要站点标识或回调参数。
- 外部 `expire_seconds` 实际是 600 秒还是 180 秒，new-api 是否统一压缩为 180 秒。
- 外部 `auth_code` 是否还有二次换取 openid 的接口；如果没有，new-api 不应把它暴露给前端。
- 扫码登录是否必须强制通过 2FA。
- 微信绑定是否也要支持扫码绑定，而不是继续验证码绑定。
- 生产环境是否多实例部署；如果多实例，login_token 状态必须使用 Redis 或 DB sidecar，不可只用进程内存。

