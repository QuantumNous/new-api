# Chimera 桌面端认证接入（设备授权流 + Turnstile 豁免）

> 最后更新：2026-08-13
> 相关代码：`controller/chimera_device.go`、`middleware/turnstile-check.go`、`router/api-router.go`（`/api/chimera/device` 组）
> 客户端侧：chimera-code 仓库 `packages/app/src/components/chimera-connect.tsx`、`packages/desktop/src/main/ipc.ts`

## 为什么做这些改动

Chimera 桌面客户端需要用中转站账号完成登录并同步该账号下的全部令牌。直接复用
`POST /api/user/login` 有两个问题：

1. 登录接口挂了 Turnstile 人机验证（`middleware.TurnstileCheck()`），桌面端无法渲染
   Cloudflare challenge，登录必然失败（报文 "Turnstile token 为空"）。
2. 即使能通过，账号密码也会经手桌面客户端进程，安全边界不理想。

因此引入两条通道，**网页端的登录防护（Turnstile、速率限制、2FA）完全不受影响**：

| 通道 | 用途 | 状态 |
|------|------|------|
| 设备授权流（推荐） | 桌面端登录，凭据全程只在浏览器 | 本文档主体 |
| Turnstile 客户端凭证豁免 | 兜底/过渡，桌面端直接调用登录接口 | 可选启用 |

## 设备授权流（RFC 8628 最小实现）

### 流程

```txt
桌面端                              网关                            用户浏览器
  │ POST /api/chimera/device/code    │                                  │
  │──────────────────────────────────▶ 生成 device_code + user_code      │
  │◀────────────────────────────────── （auth_flows 表，10 分钟有效）     │
  │ 展示 user_code，打开浏览器 ────────────────────────────────────────────▶
  │                                   │   GET /api/chimera/device/verify │
  │                                   │◀──────────────────────────────────
  │                                   │   （极简 HTML 确认页）             │
  │                                   │   POST /api/chimera/device/authorize
  │                                   │◀── 账号密码 + Turnstile ───────────
  │                                   │   校验密码 → flow 标记 authorized  │
  │ POST /api/chimera/device/token    │                                  │
  │────────（每 3s 轮询）─────────────▶                                   │
  │◀── pending / ok{access_token} ────│                                  │
  │ 用 access_token 走 Dashboard API（GET /api/token/ 等）拉取令牌列表      │
```

### 端点契约

全部挂 `CriticalRateLimit`；`/authorize` 额外挂 `TurnstileCheck`（token 经 query `?turnstile=` 传入，与网页登录一致）。

| 端点 | 认证 | 请求 | 响应 |
|------|------|------|------|
| `POST /api/chimera/device/code` | 匿名 | 空 | `{ device_code, user_code, verification_uri, expires_in: 600, interval: 3 }` |
| `GET /api/chimera/device/verify?user_code=XXXX-XXXX` | 匿名 | — | 确认页 HTML |
| `POST /api/chimera/device/authorize?turnstile=...` | 匿名 + Turnstile | `{ user_code, username, password }` | `{ success, data: { authorized: true } }` |
| `POST /api/chimera/device/token` | 匿名 | `{ device_code }` | `{ data: { status: "pending" \| "ok" \| "expired", access_token?, token_type? } }` |

### 存储设计

复用 `auth_flows` 表（`model.AuthFlow`），新增 Purpose 值 `chimera_device_login`：

- `device_code` 即 flow token，服务端只存 HMAC（`TokenHash`），无法反查。
- `user_code`（8 位、去混淆字母表 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`、`XXXX-XXXX` 格式）
  存入 **`SessionId` 列**（挪用该索引列做确认页反查，见 `chimeraFindPendingFlowByUserCode`）。
- `Payload` 为 `{"status":"pending"|"authorized","user_id":N}`。
- 发 token 时先经 `ConsumeAuthFlow` 原子消费 flow（一次性），再在事务外通过
  `service.CreateLoginSession(userId, "chimera_device", ip, ua)` 签发标准 dashboard
  登录会话（签发放进消费事务会在 SQLite 上自锁，故拆开；消费成功但签发失败的
  边缘情况下用户重发一次授权即可）——审计里 login method 为 `chimera_device`，
  可与网页登录区分。

### 安全边界

- 账号密码、Turnstile 验证均只发生在浏览器确认页；桌面端只持有一次性 `device_code`。
- `user_code` 8 位 31 字母表 ≈ 8.5×10^11 组合，10 分钟有效 + 全局速率限制，暴力枚举不可行。
- 开启 2FA 的账号会被 `/authorize` 明确拒绝（v1 不承接 2FA 交互），提示改用 API 密钥。
  后续如需支持，可在确认页复用现有 2FA flow（`AuthFlowPurposeTwoFALogin`）。
- 确认页由 Go 直接渲染（`ChimeraDeviceVerifyPage`），不依赖控制台 React 前端，
  升级控制台不影响此页。

## Turnstile 客户端凭证豁免（可选兜底）

`middleware/turnstile-check.go`：请求头 `X-Chimera-Desktop-Secret` 与环境变量
`DESKTOP_CLIENT_SECRET` 匹配（`crypto/subtle` 常量时间比较）时跳过 Turnstile。

- 环境变量不配置 = 通道关闭（默认零行为变化）。
- 桌面端密钥属"软保密"（可被逆向提取），仅在设备流不可用时作为过渡手段；
  速率限制照常生效，密钥可随时轮换。
- 有设备授权流之后，一般无需启用此通道。

## 部署与验证

1. 重新编译部署 new-api（设备流无需任何环境变量/配置项）。
2. 桌面端（Chimera Desktop ≥ 对应版本）连接界面选"设备授权"→ 显示设备码并自动打开浏览器。
3. 浏览器确认页输入账号密码（+Turnstile）→ 桌面端数秒内自动完成，
   同步该账号下全部启用令牌至密钥管理器。
4. 验证审计：登录记录的 method 应为 `chimera_device`。

## 维护提示

- 改动集中在三个文件（见文档头），全部带 `chimera:` 注释前缀，rebase 上游
  new-api 时冲突面小、易识别。
- `auth_flows` 表由既有清理机制回收过期行；本流程未新增表和迁移。
- 如需吊销所有进行中的设备授权：`DELETE FROM auth_flows WHERE purpose = 'chimera_device_login'`。
